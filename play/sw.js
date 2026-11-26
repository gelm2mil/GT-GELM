self.addEventListener("install",event=>{self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(self.clients.claim());});
// No intercepta ni almacena audio: evita problemas con streaming y solicitudes Range.
