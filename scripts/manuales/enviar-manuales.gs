/**
 * AG Criminalística — envío automático de los manuales gratuitos por correo.
 *
 * Se publica como "Aplicación web" de Google Apps Script (gratis, corre en los
 * servidores de Google). La web le envía nombre, correo y manual; este script
 * manda el PDF adjunto al visitante desde tu cuenta de Gmail y te avisa a ti.
 *
 * Límite de Gmail gratuito: unos 100 correos al día.
 */

const OWNER = 'asgutierrezt@gmail.com';   // recibe el aviso de cada descarga
const REPLY_TO = 'asgutierrezt@gmail.com'; // a quién responden los visitantes (puede ser info@agcriminalistica.com)
const SITE = 'https://agcriminalistica.com';

const MANUALS = {
  'manual-dactiloscopia': {
    title: 'Manual de Dactiloscopia',
    file: '/manuales/manual-dactiloscopia.pdf',
  },
  'manual-voz': {
    title: 'Manual de Identificación Forense de la Voz',
    file: '/manuales/manual-identificacion-forense-de-la-voz.pdf',
  },
};

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.botcheck) return out_({ ok: true });

    const manual = MANUALS[p.manual];
    const email = String(p.email || '').trim().toLowerCase();
    const name = String(p.nombre || '').trim().slice(0, 80);
    if (!manual || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return out_({ ok: false, error: 'datos' });
    }

    // Evita reenvíos repetidos al mismo correo durante 6 horas.
    const cache = CacheService.getScriptCache();
    const key = 'm:' + email + ':' + p.manual;
    if (cache.get(key)) return out_({ ok: true, repetido: true });
    if (MailApp.getRemainingDailyQuota() < 2) return out_({ ok: false, error: 'cuota' });

    const pdf = UrlFetchApp.fetch(SITE + manual.file).getBlob().setName(manual.file.split('/').pop());
    const first = name.split(' ')[0] || '';

    MailApp.sendEmail({
      to: email,
      name: 'AG Criminalística',
      replyTo: REPLY_TO,
      subject: 'Tu ' + manual.title + ' (PDF)',
      htmlBody: visitorHtml_(first, manual),
      body: 'Hola ' + first + ', adjuntamos tu ' + manual.title + '. También puedes descargarlo en ' + SITE + manual.file,
      attachments: [pdf],
    });

    MailApp.sendEmail({
      to: OWNER,
      replyTo: email,
      subject: 'Nueva descarga: ' + manual.title,
      body: 'Nombre: ' + (name || '-') + '\nCorreo: ' + email + '\nManual: ' + manual.title +
        '\nFecha: ' + new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }),
    });

    cache.put(key, '1', 21600);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return out_({ ok: true, servicio: 'manuales AG Criminalística' });
}

/** Ejecútala una vez desde el editor: autoriza el script y te envía un correo de prueba. */
function probar() {
  const res = doPost({ parameter: { manual: 'manual-dactiloscopia', email: OWNER, nombre: 'Prueba' } });
  Logger.log(res.getContent());
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function visitorHtml_(first, manual) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1b2733">' +
    '<div style="background:#08131f;padding:22px 26px;border-top:5px solid #f5b70a">' +
    '<p style="margin:0;color:#1ba3e0;font-size:12px;letter-spacing:2px;font-weight:bold">AG CRIMINALÍSTICA</p>' +
    '<h1 style="margin:8px 0 0;color:#ffffff;font-size:22px">' + manual.title + '</h1></div>' +
    '<div style="padding:22px 26px;border:1px solid #e3e0d9;border-top:0">' +
    '<p>Hola' + (first ? ' ' + first : '') + ',</p>' +
    '<p>Gracias por tu interés. Te adjuntamos el <strong>' + manual.title + '</strong> en PDF.</p>' +
    '<p style="margin:22px 0"><a href="' + SITE + manual.file + '" style="background:#f5b70a;color:#08131f;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Descargar el manual</a></p>' +
    '<p>Si necesitas un peritaje criminalístico, una reconstrucción 3D de los hechos o asesoría técnica para un caso, responde a este correo y te atenderemos.</p>' +
    '<p style="color:#4a5868;font-size:13px">AG Criminalística · ' + SITE.replace('https://', '') + '</p>' +
    '</div></div>';
}
