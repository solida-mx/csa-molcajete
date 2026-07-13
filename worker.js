/* ============================================================
   MOLCAJETE · worker.js  (v3 — con inicio de sesión)
   Sirve los archivos del sitio y expone las APIs sobre el
   MISMO almacén KV (binding DISPO):

     /api/login            → inicio de sesión de administración
     /api/logout           → cerrar sesión
     /api/sesion           → verificar si la sesión sigue viva
     /api/disponibilidad   → platillos agotados
     /api/comandas         → comandas en vivo + reporte de ventas

   RUTAS (v3):
   · /        → panel de ADMINISTRACIÓN (pide usuario y contraseña)
   · /menu/   → menú de los COMENSALES (los QR abren /menu/?mesa=N)

   SEGURIDAD (v3):
   · El panel de administración pide USUARIO y CONTRASEÑA.
   · Al entrar se genera un TOKEN de sesión que vive en KV
     durante SESION_HORAS y caduca solo.
   · Ya NO existe la clave fija en el HTML (la anterior
     "molcajete-dispo-2026" queda revocada al publicar esto).
   · worker.js, wrangler.jsonc y los .txt ya no se sirven
     como archivos públicos.
   ============================================================ */

/* ----- CUENTAS DE ADMINISTRACIÓN -----
   Dos roles:
   · "duena"   → ve TODOS los datos del negocio (ventas, comandas…)
   · "soporte" → entra a la aplicación VACÍA, sin datos del negocio,
                 solo para revisar estructura y diseño. El propio
                 servidor le responde listas vacías y le bloquea
                 cualquier cambio: no es solo un ocultamiento visual.

   Las claves de abajo son solo las INICIALES. En cuanto alguien
   cambia su contraseña desde la pantalla de inicio de sesión, la
   nueva se guarda HASHEADA en el KV (clave "usr:<usuario>") y la
   de este archivo deja de valer para esa cuenta.                  */
const CUENTAS_INICIALES = {
  "molcajete": { clave: "Molcajete-2VwsK1QWiV", rol: "duena" },
  "soporte":   { clave: "Soporte-xEKGUC2ogj",   rol: "soporte" },
};

const SESION_HORAS = 12;              // duración de la sesión de administración
const KDS_HORAS = 14;                 // vida del "pase de cocina" (pantalla sin precios).
                                      // Es INDEPENDIENTE de la sesión de administración:
                                      // mientras la pantalla de cocina siga abierta se
                                      // renueva sola (keepalive) y no se apaga a media
                                      // jornada; si nadie la usa, caduca por su cuenta.
const MAX_INTENTOS = 8;               // intentos de login fallidos por IP…
const VENTANA_INTENTOS = 600;         // …en esta ventana (segundos)
const TTL_COMANDA = 30 * 3600;        // las comandas viven 30 h y se borran solas

const JSONH = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const j = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSONH });

/* Hash de contraseña (SHA-256 con sal aleatoria por cuenta) */
async function hashClave(clave, salt) {
  const data = new TextEncoder().encode(salt + "\u00b7" + clave);
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* Devuelve el rol si usuario+clave son correctos; si no, null.
   Primero busca la contraseña cambiada en KV; si no hay, usa la inicial. */
async function verificaCuenta(env, usuario, clave) {
  const cuenta = CUENTAS_INICIALES[usuario];
  if (!cuenta || typeof clave !== "string" || !clave) return null;
  const guardado = await env.DISPO.get("usr:" + usuario);
  if (guardado) {
    try {
      const { salt, hash } = JSON.parse(guardado);
      return (await hashClave(clave, salt)) === hash ? cuenta.rol : null;
    } catch (e) { return null; }
  }
  return clave === cuenta.clave ? cuenta.rol : null;
}

/* ¿La petición trae un token de sesión válido? Devuelve {u, rol} o null. */
async function sesionDe(request, env) {
  const t = request.headers.get("x-token") || "";
  if (!/^[A-Za-z0-9-]{20,60}$/.test(t)) return null;
  const v = await env.DISPO.get("tok:" + t);
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}

/* ¿La URL trae un PASE DE COCINA válido (?k=…)? Devuelve el token o null.
   Este pase da acceso SOLO a la vista de cocina (platillos sin precios);
   no sirve para administración ni para modificar nada.                  */
async function paseCocina(url, env) {
  const k = (url.searchParams.get("k") || "").trim();
  if (!/^[A-Za-z0-9-]{20,60}$/.test(k)) return null;
  const v = await env.DISPO.get("kds:" + k);
  return v ? k : null;
}

/* Al cambiar una contraseña se cierran las sesiones abiertas de esa cuenta */
async function revocaSesiones(env, usuario) {
  const lista = await env.DISPO.list({ prefix: "tok:" });
  for (const k of lista.keys) {
    const v = await env.DISPO.get(k.name);
    if (!v) continue;
    try { if (JSON.parse(v).u === usuario) await env.DISPO.delete(k.name); } catch (e) {}
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* ---------------- LOGIN / SESIÓN ---------------- */
    if (path === "/api/login" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || "sin-ip";
      const failKey = "fail:" + ip;
      const fallos = parseInt(await env.DISPO.get(failKey)) || 0;
      if (fallos >= MAX_INTENTOS) return j({ error: "Demasiados intentos. Espera 10 minutos e inténtalo de nuevo." }, 429);

      let d; try { d = await request.json(); } catch (e) { return j({ error: "json invalido" }, 400); }
      const usuario = typeof d.usuario === "string" ? d.usuario.trim().toLowerCase() : "";
      const rol = await verificaCuenta(env, usuario, d.clave);

      if (rol) {
        const token = crypto.randomUUID();
        await env.DISPO.put("tok:" + token, JSON.stringify({ u: usuario, rol, ts: Date.now() }),
          { expirationTtl: SESION_HORAS * 3600 });
        await env.DISPO.delete(failKey);
        return j({ ok: true, token, usuario, rol, horas: SESION_HORAS });
      }
      await env.DISPO.put(failKey, String(fallos + 1), { expirationTtl: VENTANA_INTENTOS });
      return j({ error: "Usuario o contraseña incorrectos." }, 401);
    }

    /* Cambio de contraseña desde la pantalla de inicio de sesión
       (cualquiera de las dos cuentas; pide la contraseña actual). */
    if (path === "/api/cambiar-clave" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || "sin-ip";
      const failKey = "fail:" + ip;
      const fallos = parseInt(await env.DISPO.get(failKey)) || 0;
      if (fallos >= MAX_INTENTOS) return j({ error: "Demasiados intentos. Espera 10 minutos e inténtalo de nuevo." }, 429);

      let d; try { d = await request.json(); } catch (e) { return j({ error: "json invalido" }, 400); }
      const usuario = typeof d.usuario === "string" ? d.usuario.trim().toLowerCase() : "";
      const nueva = typeof d.claveNueva === "string" ? d.claveNueva : "";
      if (nueva.length < 8 || nueva.length > 60) {
        return j({ error: "La contraseña nueva debe tener entre 8 y 60 caracteres." }, 400);
      }
      const rol = await verificaCuenta(env, usuario, d.claveActual);
      if (!rol) {
        await env.DISPO.put(failKey, String(fallos + 1), { expirationTtl: VENTANA_INTENTOS });
        return j({ error: "Usuario o contraseña actual incorrectos." }, 401);
      }
      const salt = crypto.randomUUID();
      await env.DISPO.put("usr:" + usuario, JSON.stringify({ salt, hash: await hashClave(nueva, salt), t: Date.now() }));
      await revocaSesiones(env, usuario);   // cierra sesiones abiertas de esa cuenta
      await env.DISPO.delete(failKey);
      return j({ ok: true });
    }

    if (path === "/api/logout" && request.method === "POST") {
      const t = request.headers.get("x-token") || "";
      if (/^[A-Za-z0-9-]{20,60}$/.test(t)) await env.DISPO.delete("tok:" + t);
      return j({ ok: true });
    }

    if (path === "/api/sesion" && request.method === "GET") {
      const s = await sesionDe(request, env);
      if (!s) return j({ error: "sesion invalida" }, 401);
      return j({ ok: true, usuario: s.u, rol: s.rol });
    }

    /* ---------------- DISPONIBILIDAD ---------------- */
    if (path === "/api/disponibilidad") {
      if (request.method === "GET") {           // pública: la lee el menú de los comensales
        const guardado = await env.DISPO.get("estado");
        return new Response(guardado || '{"off":[]}', { headers: JSONH });
      }
      if (request.method === "POST") {          // solo administración
        const s = await sesionDe(request, env);
        if (!s) return j({ error: "sesion invalida" }, 401);
        if (s.rol === "soporte") return j({ error: "Cuenta de soporte: es solo de lectura y no puede modificar el negocio." }, 403);
        let data; try { data = await request.json(); } catch (e) { return j({ error: "json invalido" }, 400); }
        if (!data || !Array.isArray(data.off)) return j({ error: "formato invalido" }, 400);
        const limpio = { off: data.off.filter(x => typeof x === "string" && x.length <= 40).slice(0, 300), t: Date.now() };
        await env.DISPO.put("estado", JSON.stringify(limpio));
        return j({ ok: true });
      }
      return j({ error: "metodo no permitido" }, 405);
    }

    /* ---------------- COMANDAS / VENTAS ---------------- */
    if (path === "/api/comandas") {

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

      // La CAJA lista todas las comandas (requiere sesión)
      if (request.method === "GET") {
        const s = await sesionDe(request, env);
        if (!s) return j({ error: "sesion invalida" }, 401);
        // PRIVACIDAD: la cuenta de soporte recibe la lista VACÍA desde el
        // servidor; las ventas y comandas de la clienta no salen de aquí.
        if (s.rol === "soporte") return j({ comandas: [], soporte: true });
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
    if (path === "/api/comandas/estado" && request.method === "POST") {
      const s = await sesionDe(request, env);
      if (!s) return j({ error: "sesion invalida" }, 401);
      if (s.rol === "soporte") return j({ error: "Cuenta de soporte: es solo de lectura y no puede modificar el negocio." }, 403);
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

    /* ---------------- PANTALLA DE COCINA (sin precios) ----------------
       La administración crea un "pase de cocina" (POST /api/cocina/nuevo)
       y abre /cocina/?k=<pase> en una pantalla aparte. Esa pantalla lee
       las comandas por /api/cocina?k=<pase> SIN precios y las mantiene
       sincronizadas: cuando en administración se marca una comanda como
       entregada, aquí desaparece en la siguiente actualización.
       El pase es INDEPENDIENTE de la sesión de administración.          */

    // La administración (cuenta dueña) crea/renueva un pase de cocina
    if (path === "/api/cocina/nuevo" && request.method === "POST") {
      const s = await sesionDe(request, env);
      if (!s) return j({ error: "sesion invalida" }, 401);
      if (s.rol === "soporte") return j({ error: "Cuenta de soporte: no puede abrir la pantalla de cocina." }, 403);
      const token = crypto.randomUUID();
      await env.DISPO.put("kds:" + token, JSON.stringify({ rol: "cocina", ts: Date.now() }),
        { expirationTtl: KDS_HORAS * 3600 });
      return j({ ok: true, token, url: "/cocina/?k=" + token, horas: KDS_HORAS });
    }

    // La pantalla de cocina se mantiene viva mientras esté abierta
    if (path === "/api/cocina/keepalive" && request.method === "POST") {
      const k = await paseCocina(url, env);
      if (!k) return j({ error: "pase de cocina invalido o caducado" }, 401);
      await env.DISPO.put("kds:" + k, JSON.stringify({ rol: "cocina", ts: Date.now() }),
        { expirationTtl: KDS_HORAS * 3600 });
      return j({ ok: true, horas: KDS_HORAS });
    }

    // La pantalla de cocina lee las comandas ACTIVAS, SIN precios ni pago
    if (path === "/api/cocina" && request.method === "GET") {
      const k = await paseCocina(url, env);
      if (!k) return j({ error: "pase de cocina invalido o caducado" }, 401);
      const lista = await env.DISPO.list({ prefix: "cmd:" });
      const out = [];
      for (const key of lista.keys) {
        const v = await env.DISPO.get(key.name);
        if (!v) continue;
        try {
          const o = JSON.parse(v);
          if (o.estado !== "activa") continue;           // ya entregadas: fuera
          out.push({                                      // SIN total ni importes ni pago
            id: key.name, ts: o.ts, folio: o.folio, tipo: o.tipo,
            destino: o.destino, notas: o.notas,
            items: (o.items || []).map(it => ({ q: it.q, n: it.n, sel: it.sel })),
          });
        } catch (e) {}
      }
      out.sort((a, b) => a.ts - b.ts);   // el más antiguo primero
      return j({ comandas: out });
    }

    /* ---------------- RUTAS Y PROTECCIÓN DE ARCHIVOS ---------------- */

    /* La RAÍZ (/) es el panel de administración (index.html) y el
       menú de los comensales vive en /menu/ (los QR abren
       /menu/?mesa=1, ?mesa=2…). Rutas viejas y atajos → a su lugar: */
    if (path === "/mesas" || path === "/mesas/" || path === "/admin" || path === "/admin/") {
      return Response.redirect(url.origin + "/", 301);
    }
    if (path === "/menu") {           // sin diagonal final: conservar ?mesa=N
      return Response.redirect(url.origin + "/menu/" + url.search, 301);
    }
    if (path === "/cocina") {         // sin diagonal final: conservar ?k=<pase>
      return Response.redirect(url.origin + "/cocina/" + url.search, 301);
    }

    // Estos archivos NUNCA se sirven al público (contienen configuración)
    if (path === "/worker.js" || path === "/wrangler.jsonc" || path.toLowerCase().endsWith(".txt")) {
      return new Response("No encontrado", { status: 404 });
    }

    // Todo lo demás: servir los archivos estáticos del repo
    return env.ASSETS.fetch(request);
  },
};
