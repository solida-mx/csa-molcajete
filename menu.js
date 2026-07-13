/* ============================================================
   MOLCAJETE · MENÚ COMPARTIDO
   Este archivo lo usan LAS DOS páginas:
     · index.html        (menú que ven los comensales)
     · mesas/index.html  (QR de mesas + pestaña Disponibilidad)
   AQUÍ es donde se edita el menú de ahora en adelante:
     · p: precio · n: nombre · d: descripción · img: emoji
     · ops: opciones que se preguntan al comensal; el número de
       cada opción es el costo extra, ej. ["Barbacoa",5] = +$5.
     · id: NO lo cambies una vez publicado (la disponibilidad
       guardada se liga a ese id).
   ============================================================ */
/* ---------- MENÚ (según menú nuevo julio 2026) ---------- */
const GUISOS=["Picadillo","Deshebrada","Chicharrón prensado","Queso en rajas","Asado de puerco"];
const gch=(dpBarb)=>GUISOS.map(g=>[g,0]).concat([["Barbacoa",dpBarb]]);
const GUAR=["Spaghetti poblano","Arroz blanco con elote","Arroz rojo","Puré de papa","Frijoles refritos","Verduras al vapor","Papas a la francesa","Fusilli a la boloñesa"].map(g=>[g,0]);
const GUARN=["Arroz blanco con elote","Arroz rojo","Espagueti poblano","Puré de papa","Frijoles refritos","Verduras al vapor","Papas a la francesa"].map(g=>[g,0]);
const G2=[{t:"Guarnición 1",c:GUAR},{t:"Guarnición 2",c:GUAR}];
const REFRESCOS=["Coca-Cola","Pepsi","Manzanita Sol","Mirinda","7Up","Squirt"].map(s=>[s,0]);

const MENU={
 "Desayunos":{em:"🍳",items:[
   {id:"chil",n:"Chilaquiles",d:"Totopos bañados en salsa, gratinados con queso manchego, crema, cebolla morada y cilantro. Con frijoles con queso fresco.",p:120,img:"🥘",
     ops:[{t:"Salsa",c:[["Verde",0],["Roja",0]]},{t:"Servidos con",c:gch(0).concat([["Huevos al gusto",0]])}]},
   {id:"tacom",n:"Taco mañanero",d:"Con el guiso de tu elección.",p:20,img:"🌮",
     ops:[{t:"Tortilla",c:[["Harina",0],["Maíz",0]]},{t:"Guiso",c:gch(5)}]},
   {id:"tacos5",n:"Orden de 5 tacos",d:"Tacos mañaneros, harina o maíz.",p:90,img:"🌮",
     ops:[{t:"Tortilla",c:[["Harina",0],["Maíz",0]]},{t:"Guiso",c:gch(25)}]},
   {id:"burr",n:"Burrito",d:"Tortilla grande de harina rellena del guiso a elegir, con ensalada.",p:50,img:"🌯",
     ops:[{t:"Guiso",c:gch(20)}]},
   {id:"gord",n:"Gordita",d:"De harina, acompañada con ensalada.",p:20,img:"🫓",
     ops:[{t:"Guiso",c:gch(5)}]},
   {id:"hotc",n:"Hot-cakes",d:"3 hot-cakes con mantequilla, mermelada de fresa y miel de maple.",p:100,img:"🥞"},
   {id:"gringo",n:"Desayuno gringo",d:"2 huevos al gusto, 2 hot-cakes y 3 tiras de tocino.",p:120,img:"🥓"},
   {id:"huev",n:"Huevos al gusto",d:"2 huevos acompañados con frijoles refritos.",p:100,img:"🍳",
     ops:[{t:"Acompañamiento",c:[["Solo frijoles",0]].concat(GUISOS.concat(["Barbacoa"]).map(g=>[g,20]))}]},
   {id:"omel",n:"Omelette",d:"Jamón, queso, chile, tomate y cebolla. Con frijoles refritos.",p:125,img:"🥚"}]},
 "Comidas":{em:"🍽️",nota:"Cada platillo marcado con «elige tus guarniciones» incluye 2 guarniciones: spaghetti poblano, arroz blanco con elote, arroz rojo, puré de papa, frijoles refritos, verduras al vapor, papas a la francesa o fusilli a la boloñesa.",items:[
   {id:"ensu",n:"Enchiladas suizas",d:"4 piezas de pollo bañadas en salsa verde, mezcla de quesos y crema.",p:130,img:"🫔",ops:G2},
   {id:"enro",n:"Enchiladas rojas",d:"4 piezas bañadas en salsa de chile guajillo y crema.",p:130,img:"🫔",
     ops:[{t:"Relleno",c:[["Pollo",0],["Queso",0]]}].concat(G2)},
   {id:"ento",n:"Entomatadas",d:"4 piezas de pollo bañadas en salsa de tomate, quesos y crema.",p:130,img:"🍅",ops:G2},
   {id:"enchi",n:"Enchipotladas",d:"4 piezas de pollo en salsa cremosa de chipotle, quesos y crema.",p:130,img:"🌶️",ops:G2},
   {id:"chrel",n:"Chile relleno",d:"Chile poblano capeado.",p:140,img:"🫑",
     ops:[{t:"Preparación",c:[["De picadillo",0],["De queso",0],["Ambos, bañado en crema de chipotle",15]]}].concat(G2)},
   {id:"milemp",n:"Milanesa empanizada",d:"Empanizado dorado y crujiente.",p:130,img:"🍗",
     ops:[{t:"Carne",c:[["Pollo",0],["Res",10]]}].concat(G2)},
   {id:"alb",n:"Albóndigas rellenas",d:"Rellenas de queso crema.",p:130,img:"🧆",
     ops:[{t:"Salsa",c:[["Crema de chipotle",0],["Salsa roja italiana",0]]}].concat(G2)},
   {id:"milpla",n:"Milanesa a la plancha",d:"De pollo, jugosa y a la plancha.",p:130,img:"🍗",ops:G2},
   {id:"enspo",n:"Ensalada de pollo",d:"Ensalada fresca con pollo.",p:130,img:"🥗",
     ops:[{t:"Pollo",c:[["A la plancha",0],["Empanizado",20]]}]},
   {id:"hamb",n:"Hamburguesa mexicana",d:"Con papas fritas y jalapeño.",p:120,img:"🍔"},
   {id:"club",n:"Club sándwich",d:"Pollo en chipotle, jamón, queso, guacamole y mayonesa. Con papas fritas y jalapeños.",p:140,img:"🥪"}]},
 "Para los niños":{em:"🧒",nota:"Todo a $80. Cada opción incluye 1 guarnición a elegir.",items:[
   {id:"nmigas",n:"Huevo con migas",p:80,img:"🍳",ops:[{t:"Guarnición",c:GUARN}]},
   {id:"njam",n:"Huevo con jamón o salchicha",p:80,img:"🍳",
     ops:[{t:"Con",c:[["Jamón",0],["Salchicha",0]]},{t:"Guarnición",c:GUARN}]},
   {id:"nhot",n:"2 hot-cakes",p:80,img:"🥞",ops:[{t:"Guarnición",c:GUARN}]},
   {id:"ntacos",n:"2 tacos",p:80,img:"🌮",
     ops:[{t:"Tortilla",c:[["Harina",0],["Maíz",0]]},{t:"Guarnición",c:GUARN}]},
   {id:"nsinc",n:"Sincronizada",p:80,img:"🧀",ops:[{t:"Guarnición",c:GUARN}]},
   {id:"ntiras",n:"Tiras de pollo empanizadas",p:80,img:"🍗",ops:[{t:"Guarnición",c:GUARN}]},
   {id:"nhotdog",n:"Hot dog",p:80,img:"🌭",ops:[{t:"Guarnición",c:GUARN}]},
   {id:"ngord",n:"2 gorditas de harina",p:80,img:"🫓",ops:[{t:"Guarnición",c:GUARN}]}]},
 "Bebidas":{em:"🥤",items:[
   {id:"agua",n:"Agua natural",d:"500 ml.",p:10,img:"💧"},
   {id:"fresca",n:"Agua fresca",d:"500 ml, hecha en casa.",p:30,img:"🍹",
     ops:[{t:"Sabor",c:[["Jamaica con guayaba",0],["Pepino con limón",0]]}]},
   {id:"cafeam",n:"Café americano",p:25,img:"☕"},
   {id:"cafeolla",n:"Café de olla",p:30,img:"☕"},
   {id:"ref4",n:"Refresco 400 ml",p:20,img:"🥤",ops:[{t:"Sabor",c:REFRESCOS}]},
   {id:"ref6",n:"Refresco 600 ml",p:30,img:"🥤",ops:[{t:"Sabor",c:REFRESCOS}]}]},
 "Postres":{em:"🍮",items:[
   {id:"pay",n:"Pay de limón",p:30,img:"🍰"},
   {id:"arrozl",n:"Arroz con leche",p:25,img:"🍮",
     ops:[{t:"Estilo",c:[["Natural",0],["Con pasas",5]]}]}]},
 "Extras":{em:"🌽",items:[
   {id:"tort",n:"Orden de tortillas",p:10,img:"🫓"},
   {id:"guac",n:"Guacamole y totopos",p:30,img:"🥑"},
   {id:"toto",n:"Totopos",p:15,img:"🌽"},
   {id:"papas",n:"Papas a la francesa",p:30,img:"🍟"},
   {id:"huevoex",n:"Huevo al gusto",p:10,img:"🍳"},
   {id:"guarex",n:"Guarnición extra",p:25,img:"🍚",ops:[{t:"Elige",c:GUAR}]}]}
};
const ALL={};Object.values(MENU).forEach(c=>c.items.forEach(it=>ALL[it.id]=it));
