import { displayRegNo } from './regno.js';

export const DOC_LABELS = {
  en: {
    insurance: 'Insurance', puc: 'PUC', fitness: 'Fitness certificate', permit: 'Permit', road_tax: 'Road tax',
    green_tax: 'Green tax', speed_governor: 'Speed governor certificate', vltd: 'VLTD/GPS', reflective_tape: 'Reflective tape certificate',
    fastag: 'FASTag', rc: 'RC validity', driving_licence: 'Driving licence', health: 'Health insurance', life: 'Life insurance',
  },
  hi: {
    insurance: 'बीमा', puc: 'पीयूसी', fitness: 'फिटनेस प्रमाणपत्र', permit: 'परमिट', road_tax: 'रोड टैक्स',
    green_tax: 'ग्रीन टैक्स', speed_governor: 'स्पीड गवर्नर प्रमाणपत्र', vltd: 'वीएलटीडी/जीपीएस', reflective_tape: 'रिफ्लेक्टिव टेप प्रमाणपत्र',
    fastag: 'फास्टैग', rc: 'आरसी वैधता', driving_licence: 'ड्राइविंग लाइसेंस', health: 'स्वास्थ्य बीमा', life: 'जीवन बीमा',
  },
  mr: {
    insurance: 'विमा', puc: 'पीयूसी', fitness: 'फिटनेस प्रमाणपत्र', permit: 'परमिट', road_tax: 'रोड टॅक्स',
    green_tax: 'ग्रीन टॅक्स', speed_governor: 'स्पीड गव्हर्नर प्रमाणपत्र', vltd: 'व्हीएलटीडी/जीपीएस', reflective_tape: 'रिफ्लेक्टिव्ह टेप प्रमाणपत्र',
    fastag: 'फास्टॅग', rc: 'आरसी वैधता', driving_licence: 'वाहन परवाना', health: 'आरोग्य विमा', life: 'जीवन विमा',
  },
};

// docType "default" = before expiry, "expired" = after expiry.
export const DEFAULT_TEMPLATES = {
  default: {
    mr: 'नमस्कार {name} जी 🙏\nआपल्या {vehicle} वाहनाचा {doc} {expiry} रोजी संपत आहे. दंड व त्रास टाळण्यासाठी वेळेवर नूतनीकरण करा.\nसंपर्क: {agent_name}, {agent_phone}',
    hi: 'नमस्ते {name} जी 🙏\nआपके वाहन {vehicle} का {doc} {expiry} को समाप्त हो रहा है। जुर्माने से बचने के लिए समय पर नवीनीकरण कराएं।\nसंपर्क: {agent_name}, {agent_phone}',
    en: 'Hello {name} 🙏\nThe {doc} for your vehicle {vehicle} expires on {expiry}. Renew on time to avoid fines.\nContact: {agent_name}, {agent_phone}',
  },
  expired: {
    mr: 'नमस्कार {name} जी,\nआपल्या {vehicle} वाहनाचा {doc} {expiry} रोजी संपला आहे. कृपया लवकरात लवकर नूतनीकरण करा.\nसंपर्क: {agent_name}, {agent_phone}',
    hi: 'नमस्ते {name} जी,\nआपके वाहन {vehicle} का {doc} {expiry} को समाप्त हो गया है। कृपया जल्द से जल्द नवीनीकरण कराएं।\nसंपर्क: {agent_name}, {agent_phone}',
    en: 'Hello {name},\nThe {doc} for your vehicle {vehicle} expired on {expiry}. Please renew it as soon as possible.\nContact: {agent_name}, {agent_phone}',
  },
};

export function formatDate(d) {
  if (!d) return '';
  const x = new Date(d);
  const ist = new Date(x.getTime() + 330 * 60000);
  return `${String(ist.getUTCDate()).padStart(2, '0')}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${ist.getUTCFullYear()}`;
}

export function renderTemplate(body, vars) {
  return body.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

export function buildVars({ customer, vehicle, doc, agent, language }) {
  const lang = DOC_LABELS[language] ? language : 'en';
  return {
    name: customer?.name || '',
    vehicle: vehicle ? displayRegNo(vehicle.regNo) : '',
    doc: DOC_LABELS[lang][doc.type] || doc.type,
    expiry: formatDate(doc.expiryDate),
    agent_name: agent?.name || '',
    agent_phone: agent?.mobile || '',
  };
}

/** wa.me needs digits with country code; assume India for 10-digit numbers. */
export function waNumber(phone = '') {
  const d = String(phone).replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`;
  return d;
}

export function waLink(phone, text) {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}
