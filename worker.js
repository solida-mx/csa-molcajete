/* ============================================================
   MOLCAJETE · worker.js  (v2)
   Sirve los archivos del sitio y agrega dos APIs, ambas sobre
   el MISMO almacén KV (binding DISPO):

     /api/disponibilidad  → platillos agotados
     /api/comandas        → comandas en vivo + reporte de ventas

   La CLAVE debe ser LA MISMA que CLAVE_SYNC en mesas/index.html.
   ============================================================ */

const CLAVE = "molcajete-dispo-2026";
const TTL_COMANDA = 30 * 3600;   // las comandas viven 30 h y se borran solas
const JSONH = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

const j = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSONH });
const esAdmin = (req) => req.headers.get("x-clave") === CLAVE;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* ---------------- DISPONIBILIDAD ---------------- */
    if (url.pathname === "/api/disponibilidad") {
      if (request.method === "GET") {
        const guardado = await env.DISPO.get("estado");
        return new Response(guardado || '{"off":[]}', { headers: JSONH });
      }
      if (request.method === "POST") {
        if (!esAdmin(request)) return j({ error: "clave incorrecta" }, 401);
        let data; try { data = await request.json(); } catch (e) { return j({ error: "json invalido" }, 400); }
        if (!data || !Array.isArray(data.off)) return j({ error: "formato invalido" }, 400);
        const limpio = { off: data.off.filter(x => typeof x === "string" && x.length <= 40).slice(0, 300), t: Date.now() };
        await env.DISPO.put("estado", JSON.stringify(limpio));
        return j({ ok: true });
      }
      return j({ error: "metodo no permitido" }, 405);
    }

    /* ---------------- COMANDAS / VENTAS ---------------- */
    if (url.pathname === "/api/comandas") {

      // Los COMENSALES envían su orden (público, igual que enviar un WhatsApp)
      if (request.method === "POST") {
        let d; try { d = await request.json(); } catch (e) { return j({ error: "json invalido" }, 400); }
        const s = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
        if (!d || !Array.isArray(d.items) || !d.items.length || d.items.length > 60) return j({ error: "orden invalida" }, 400);
        const items = d.items.map(it => ({
          q: Math.min(99, Math.max(1, parseInt(it.q) || 1)),
          n: s(it.n, 90),
          sel: s(it.sel, 240),
          imp: Math.min(99999, Math.max(0, Math.round(Number(it.imp) || 0))),
        }));
        const total = Math.min(999999, Math.max(0, Math.round(Number(d.total) || 0)));
        const ts = Date.now();
        const comanda = {
          v: 1, ts,
          vence: ts + TTL_COMANDA * 1000,
          folio: s(d.folio, 14) || ("CMD-" + String(ts).slice(-5)),
          tipo: d.tipo === "llevar" ? "llevar" : "mesa",
          destino: s(d.destino, 120),
          pago: ["Efectivo", "Tarjeta", "Transferencia"].includes(d.pago) ? d.pago : "Efectivo",
          notas: s(d.notas, 300),
          items, total,
          estado: "activa",
        };
        const id = "cmd:" + ts + "-" + Math.random().toString(36).slice(2, 6);
        await env.DISPO.put(id, JSON.stringify(comanda), { expirationTtl: TTL_COMANDA });
        return j({ ok: true, id, folio: comanda.folio });
      }

      // La CAJA lista todas las comandas (requiere la clave)
      if (request.method === "GET") {
        if (!esAdmin(request)) return j({ error: "clave incorrecta" }, 401);
        const lista = await env.DISPO.list({ prefix: "cmd:" });
        const out = [];
        for (const k of lista.keys) {
          const v = await env.DISPO.get(k.name);
          if (!v) continue;
          try { const o = JSON.parse(v); o.id = k.name; out.push(o); } catch (e) {}
        }
        out.sort((a, b) => a.ts - b.ts);   // primeras entradas, primeras salidas
        return j({ comandas: out });
      }

      return j({ error: "metodo no permitido" }, 405);
    }

    // La CAJA cambia el estado de una comanda (hecha / activa)
    if (url.pathname === "/api/comandas/estado" && request.method === "POST") {
      if (!esAdmin(request)) return j({ error: "clave incorrecta" }, 401);
      let d; try { d = await request.json(); } catch (e) { return j({ error: "json invalido" }, 400); }
      if (!d || typeof d.id !== "string" || !d.id.startsWith("cmd:")) return j({ error: "id invalido" }, 400);
      if (!["hecha", "activa"].includes(d.estado)) return j({ error: "estado invalido" }, 400);
      const v = await env.DISPO.get(d.id);
      if (!v) return j({ error: "no existe" }, 404);
      let o; try { o = JSON.parse(v); } catch (e) { return j({ error: "dato corrupto" }, 500); }
      o.estado = d.estado;
      o.hechaTs = d.estado === "hecha" ? Date.now() : null;
      // conservar la fecha de caducidad original (KV borra la comanda solo)
      const restante = Math.max(60, Math.round(((o.vence || Date.now() + 3600000) - Date.now()) / 1000));
      await env.DISPO.put(d.id, JSON.stringify(o), { expirationTtl: restante });
      return j({ ok: true });
    }

    // Todo lo demás: servir los archivos estáticos del repo
    return env.ASSETS.fetch(request);
  },
};
