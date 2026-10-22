import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as phase2 from './i18n2.js';

const en = {
  appName: 'Vahan Seva Kendra', name: 'Name',
  tagline: 'Vehicle documents and renewals, in one place',
  nav_dashboard: 'Home', nav_due: 'Due List', nav_customers: 'Customers', nav_add: 'Add', nav_reports: 'Reports',
  login: 'Log in', logout: 'Log out', register: 'Create account', mobile: 'Mobile number', password: 'Password',
  businessName: 'Business name', yourName: 'Your name', city: 'Village / City', haveAccount: 'Already have an account? Log in',
  noAccount: 'New here? Create an account', trialNote: '15-day free trial. No card needed.',
  save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete', back: 'Back', loading: 'Loading…', retry: 'Retry',
  search: 'Search', searchPlaceholder: 'Name, mobile, reg no., policy no., chassis no.',
  noResults: 'Nothing found', optional: 'optional', required: 'required',
  // dashboard
  greeting: 'Namaste', customers: 'Customers', vehicles: 'Vehicles', remindersPending: 'Reminders pending',
  rcCredits: 'RC credits', rcFetchesMonth: 'RC fetches this month',
  expired: 'Expired', due7: '≤ 7 days', due15: '8–15 days', due30: '16–30 days', active: 'Active',
  todaysCalls: "Today's call list", noCalls: 'No one to call today. Well done!',
  call: 'Call', whatsapp: 'WhatsApp', daysLeft: '{n} days left', dueToday: 'Due today', expiredAgo: 'Expired {n} days ago',
  expiresOn: 'Expires {d}', docStatus: 'Documents by status',
  // due list
  dueList: 'Due List', bulkMode: 'Send all one by one', markSent: 'Mark sent', skip: 'Skip', sent: 'Sent',
  queueEmpty: 'No reminders waiting. The queue refreshes every day at 8 AM.', pending: 'Pending', next: 'Next',
  bulkProgress: '{i} of {n}', bulkDone: 'All reminders handled!', openWhatsapp: 'Open WhatsApp', noWhatsapp: 'No WhatsApp number',
  // customers
  addCustomer: 'Add customer', customerName: 'Customer name', whatsappNo: 'WhatsApp number', altNo: 'Alternate number',
  sameAsMobile: 'Same as mobile', language: 'Language', tags: 'Tags', notes: 'Notes', referredBy: 'Referred by',
  tag_fleet: 'Fleet owner', tag_walkin: 'Walk-in', tag_reference: 'Reference', address: 'Address',
  fleet: '{n} vehicles', noCustomers: 'No customers yet. Tap Add to add your first vehicle.',
  personalPolicies: 'Health & life policies', addPolicy: 'Add policy', addVehicle: 'Add vehicle',
  // vehicle
  regNo: 'Registration number', fetchDetails: 'Fetch details', fetching: 'Fetching from VAHAN…',
  consent: 'Customer has consented to vehicle detail verification',
  consentNeeded: 'Tick the consent box first', invalidRegNo: 'Check the number. Example: MH08AB1234',
  invalidState: 'Unknown state code', fetchedFrom: 'Fetched {when}', fromCache: 'saved copy, no credit used',
  refresh: 'Refresh from VAHAN', refreshed: 'Updated from VAHAN', rcNotFound: 'Vehicle not found in VAHAN. Enter details manually.',
  rcFailed: 'Could not fetch details right now. Enter details manually or try again.', manualEntry: 'Enter manually',
  alreadyAdded: 'This vehicle is already in your list.', openVehicle: 'Open vehicle',
  reviewDetails: 'Check and edit before saving', owner: 'Customer (owner)', existingCustomer: 'Existing customer',
  newCustomer: 'New customer', pickCustomer: 'Search customer', vehicleType: 'Vehicle type',
  section_owner: 'Owner', section_vehicle: 'Vehicle', section_reg: 'Registration', section_docs: 'Documents found',
  ownerName: 'Owner name', fatherName: "Father's name", presentAddress: 'Present address', permanentAddress: 'Permanent address',
  maker: 'Maker', model: 'Model', variant: 'Variant', bodyType: 'Body type', vehicleClass: 'Vehicle class', fuel: 'Fuel',
  colour: 'Colour', seatingCapacity: 'Seats', grossWeight: 'GVW (kg)', unladenWeight: 'Unladen weight (kg)',
  manufacturingYear: 'Mfg. year', registrationDate: 'Registration date', rcValidUpto: 'RC valid up to', chassisNo: 'Chassis no.',
  engineNo: 'Engine no.', rto: 'RTO', financer: 'Financer / hypothecation', rcStatus: 'RC status', blacklisted: 'BLACKLISTED',
  norms: 'Emission norms', saveVehicle: 'Save vehicle', savedWithDocs: 'Saved. {n} documents added with expiry dates.',
  documents: 'Documents', history: 'History', addDocument: 'Add document', rawJson: 'Raw VAHAN data', lastFetched: 'Last fetched',
  never: 'never',
  // documents
  docType: 'Document', number: 'Number', provider: 'Insurer / issuer', startDate: 'Start date', issueDate: 'Issue date',
  expiryDate: 'Expiry date', amount: 'Amount (₹)', autoExpiry: 'Auto-filled, you can change it', policyType: 'Policy type',
  idv: 'IDV (₹)', ncb: 'NCB %', totalPremium: 'Total premium (₹)', odPremium: 'OD premium (₹)', tpPremium: 'TP premium (₹)',
  permitType: 'Permit type', uploadFile: 'Attach photo / PDF', files: 'Files', archived: 'Old',
  doc_insurance: 'Insurance', doc_puc: 'PUC', doc_fitness: 'Fitness', doc_permit: 'Permit', doc_road_tax: 'Road tax',
  doc_green_tax: 'Green tax', doc_speed_governor: 'Speed governor', doc_vltd: 'VLTD / GPS', doc_reflective_tape: 'Reflective tape',
  doc_fastag: 'FASTag', doc_rc: 'RC validity', doc_driving_licence: 'Driving licence', doc_health: 'Health insurance', doc_life: 'Life insurance',
  vt_2W: 'Two-wheeler', vt_car: 'Car', vt_pickup: 'Pickup / Bolero', vt_dumper: 'Dumper / Tipper', vt_truck: 'Truck', vt_bus: 'Bus',
  vt_tractor: 'Tractor', vt_jcb: 'JCB / Equipment', vt_auto: 'Auto rickshaw', vt_other: 'Other',
  // add menu
  addWhat: 'What do you want to add?', addVehicleHint: 'Type reg no., fetch details automatically',
  addCustomerHint: 'Name, mobile, WhatsApp', addPolicyHint: 'Health or life insurance for a customer',
  // reports
  reports: 'Reports', rcLog: 'RC fetch log', consentLog: 'Consent log', live: 'Live', cached: 'From cache', failed: 'Failed',
  cost: 'Cost', by: 'by', comingPhase2: 'Premium, commission and renewal reports arrive in Phase 2.',
  ownerOnly: 'Only the owner can see this.',
  // settings
  settings: 'Settings', appLanguage: 'App language', darkMode: 'Dark mode', templates: 'WhatsApp message templates',
  templateHelp: 'Variables: {name} {vehicle} {doc} {expiry} {agent_name} {agent_phone}', beforeExpiry: 'Before expiry',
  afterExpiry: 'After expiry', resetDefault: 'Reset to default', team: 'Team', addMember: 'Add member', role: 'Role',
  role_owner: 'Owner', role_staff: 'Staff / Agent', role_readonly: 'Read-only', canViewAll: 'Can see all customers',
  saved: 'Saved', business: 'Business', preview: 'Preview', reminderDays: 'Reminder days', reminderDaysHelp: 'Days before expiry; use -1 for 1 day after',
  error_generic: 'Something went wrong. Please try again.', error_offline: 'You are offline. Showing saved data.',
  error_invalid_credentials: 'Wrong mobile or password', error_mobile_taken: 'This mobile is already registered',
  error_rate_limited: 'Too many fetches. Wait a minute.', error_vehicle_exists: 'This vehicle is already added',
  error_read_only: 'Your account is read-only',
};

const hi = {
  appName: 'वाहन सेवा केंद्र', name: 'नाम', tagline: 'वाहन दस्तावेज़ और नवीनीकरण, एक ही जगह',
  nav_dashboard: 'होम', nav_due: 'ड्यू लिस्ट', nav_customers: 'ग्राहक', nav_add: 'जोड़ें', nav_reports: 'रिपोर्ट',
  login: 'लॉग इन', logout: 'लॉग आउट', register: 'खाता बनाएं', mobile: 'मोबाइल नंबर', password: 'पासवर्ड',
  businessName: 'व्यवसाय का नाम', yourName: 'आपका नाम', city: 'गांव / शहर', haveAccount: 'पहले से खाता है? लॉग इन करें',
  noAccount: 'नए हैं? खाता बनाएं', trialNote: '15 दिन मुफ्त ट्रायल। कार्ड की ज़रूरत नहीं।',
  save: 'सेव करें', cancel: 'रद्द करें', edit: 'बदलें', delete: 'हटाएं', back: 'पीछे', loading: 'लोड हो रहा है…', retry: 'फिर से',
  search: 'खोजें', searchPlaceholder: 'नाम, मोबाइल, गाड़ी नंबर, पॉलिसी नंबर, चेसिस नंबर',
  noResults: 'कुछ नहीं मिला', optional: 'वैकल्पिक', required: 'ज़रूरी',
  greeting: 'नमस्ते', customers: 'ग्राहक', vehicles: 'वाहन', remindersPending: 'बाकी रिमाइंडर',
  rcCredits: 'RC क्रेडिट', rcFetchesMonth: 'इस महीने RC फेच',
  expired: 'समाप्त', due7: '≤ 7 दिन', due15: '8–15 दिन', due30: '16–30 दिन', active: 'चालू',
  todaysCalls: 'आज की कॉल लिस्ट', noCalls: 'आज किसी को कॉल नहीं करना। बढ़िया!',
  call: 'कॉल', whatsapp: 'व्हाट्सऐप', daysLeft: '{n} दिन बाकी', dueToday: 'आज समाप्त', expiredAgo: '{n} दिन पहले समाप्त',
  expiresOn: '{d} को समाप्त', docStatus: 'स्थिति के अनुसार दस्तावेज़',
  dueList: 'ड्यू लिस्ट', bulkMode: 'सभी को एक-एक करके भेजें', markSent: 'भेजा गया', skip: 'छोड़ें', sent: 'भेजे गए',
  queueEmpty: 'कोई रिमाइंडर बाकी नहीं। सूची रोज़ सुबह 8 बजे बनती है।', pending: 'बाकी', next: 'अगला',
  bulkProgress: '{n} में से {i}', bulkDone: 'सभी रिमाइंडर हो गए!', openWhatsapp: 'व्हाट्सऐप खोलें', noWhatsapp: 'व्हाट्सऐप नंबर नहीं है',
  addCustomer: 'ग्राहक जोड़ें', customerName: 'ग्राहक का नाम', whatsappNo: 'व्हाट्सऐप नंबर', altNo: 'दूसरा नंबर',
  sameAsMobile: 'मोबाइल जैसा ही', language: 'भाषा', tags: 'टैग', notes: 'नोट्स', referredBy: 'किसके रेफरेंस से',
  tag_fleet: 'फ्लीट मालिक', tag_walkin: 'वॉक-इन', tag_reference: 'रेफरेंस', address: 'पता',
  fleet: '{n} वाहन', noCustomers: 'अभी कोई ग्राहक नहीं। पहला वाहन जोड़ने के लिए जोड़ें दबाएं।',
  personalPolicies: 'स्वास्थ्य और जीवन पॉलिसी', addPolicy: 'पॉलिसी जोड़ें', addVehicle: 'वाहन जोड़ें',
  regNo: 'गाड़ी नंबर', fetchDetails: 'जानकारी लाएं', fetching: 'VAHAN से जानकारी आ रही है…',
  consent: 'ग्राहक ने वाहन जानकारी सत्यापन के लिए सहमति दी है',
  consentNeeded: 'पहले सहमति बॉक्स पर टिक करें', invalidRegNo: 'नंबर जांचें। उदाहरण: MH08AB1234',
  invalidState: 'राज्य कोड गलत है', fetchedFrom: '{when} लाया गया', fromCache: 'सेव कॉपी, क्रेडिट नहीं कटा',
  refresh: 'VAHAN से रीफ्रेश करें', refreshed: 'VAHAN से अपडेट हुआ', rcNotFound: 'VAHAN में वाहन नहीं मिला। जानकारी खुद भरें।',
  rcFailed: 'अभी जानकारी नहीं आ सकी। खुद भरें या फिर से कोशिश करें।', manualEntry: 'खुद भरें',
  alreadyAdded: 'यह वाहन पहले से आपकी लिस्ट में है।', openVehicle: 'वाहन खोलें',
  reviewDetails: 'सेव करने से पहले जांचें और बदलें', owner: 'ग्राहक (मालिक)', existingCustomer: 'पुराना ग्राहक',
  newCustomer: 'नया ग्राहक', pickCustomer: 'ग्राहक खोजें', vehicleType: 'वाहन प्रकार',
  section_owner: 'मालिक', section_vehicle: 'वाहन', section_reg: 'रजिस्ट्रेशन', section_docs: 'मिले दस्तावेज़',
  ownerName: 'मालिक का नाम', fatherName: 'पिता का नाम', presentAddress: 'वर्तमान पता', permanentAddress: 'स्थायी पता',
  maker: 'कंपनी', model: 'मॉडल', variant: 'वैरिएंट', bodyType: 'बॉडी टाइप', vehicleClass: 'वाहन श्रेणी', fuel: 'ईंधन',
  colour: 'रंग', seatingCapacity: 'सीटें', grossWeight: 'GVW (किलो)', unladenWeight: 'खाली वज़न (किलो)',
  manufacturingYear: 'निर्माण वर्ष', registrationDate: 'रजिस्ट्रेशन तारीख', rcValidUpto: 'RC वैधता', chassisNo: 'चेसिस नंबर',
  engineNo: 'इंजन नंबर', rto: 'RTO', financer: 'फाइनेंसर / हाइपोथिकेशन', rcStatus: 'RC स्थिति', blacklisted: 'ब्लैकलिस्टेड',
  norms: 'उत्सर्जन मानक', saveVehicle: 'वाहन सेव करें', savedWithDocs: 'सेव हुआ। {n} दस्तावेज़ समाप्ति तारीख के साथ जुड़े।',
  documents: 'दस्तावेज़', history: 'पुराने', addDocument: 'दस्तावेज़ जोड़ें', rawJson: 'VAHAN का मूल डेटा', lastFetched: 'आखिरी बार लाया',
  never: 'कभी नहीं',
  docType: 'दस्तावेज़', number: 'नंबर', provider: 'बीमा कंपनी / जारीकर्ता', startDate: 'शुरू तारीख', issueDate: 'जारी तारीख',
  expiryDate: 'समाप्ति तारीख', amount: 'राशि (₹)', autoExpiry: 'अपने आप भरा, बदल सकते हैं', policyType: 'पॉलिसी प्रकार',
  idv: 'IDV (₹)', ncb: 'NCB %', totalPremium: 'कुल प्रीमियम (₹)', odPremium: 'OD प्रीमियम (₹)', tpPremium: 'TP प्रीमियम (₹)',
  permitType: 'परमिट प्रकार', uploadFile: 'फोटो / PDF जोड़ें', files: 'फ़ाइलें', archived: 'पुराना',
  doc_insurance: 'बीमा', doc_puc: 'पीयूसी', doc_fitness: 'फिटनेस', doc_permit: 'परमिट', doc_road_tax: 'रोड टैक्स',
  doc_green_tax: 'ग्रीन टैक्स', doc_speed_governor: 'स्पीड गवर्नर', doc_vltd: 'VLTD / GPS', doc_reflective_tape: 'रिफ्लेक्टिव टेप',
  doc_fastag: 'फास्टैग', doc_rc: 'RC वैधता', doc_driving_licence: 'ड्राइविंग लाइसेंस', doc_health: 'स्वास्थ्य बीमा', doc_life: 'जीवन बीमा',
  vt_2W: 'दोपहिया', vt_car: 'कार', vt_pickup: 'पिकअप / बोलेरो', vt_dumper: 'डंपर / टिपर', vt_truck: 'ट्रक', vt_bus: 'बस',
  vt_tractor: 'ट्रैक्टर', vt_jcb: 'JCB / मशीन', vt_auto: 'ऑटो रिक्शा', vt_other: 'अन्य',
  addWhat: 'क्या जोड़ना है?', addVehicleHint: 'गाड़ी नंबर डालें, जानकारी अपने आप आएगी',
  addCustomerHint: 'नाम, मोबाइल, व्हाट्सऐप', addPolicyHint: 'ग्राहक का स्वास्थ्य या जीवन बीमा',
  reports: 'रिपोर्ट', rcLog: 'RC फेच लॉग', consentLog: 'सहमति लॉग', live: 'लाइव', cached: 'कैश से', failed: 'विफल',
  cost: 'खर्च', by: 'द्वारा', comingPhase2: 'प्रीमियम, कमीशन और नवीनीकरण रिपोर्ट फेज़ 2 में आएंगी।',
  ownerOnly: 'यह सिर्फ मालिक देख सकते हैं।',
  settings: 'सेटिंग्स', appLanguage: 'ऐप की भाषा', darkMode: 'डार्क मोड', templates: 'व्हाट्सऐप मैसेज टेम्पलेट',
  templateHelp: 'वेरिएबल: {name} {vehicle} {doc} {expiry} {agent_name} {agent_phone}', beforeExpiry: 'समाप्ति से पहले',
  afterExpiry: 'समाप्ति के बाद', resetDefault: 'डिफ़ॉल्ट पर लौटें', team: 'टीम', addMember: 'सदस्य जोड़ें', role: 'भूमिका',
  role_owner: 'मालिक', role_staff: 'स्टाफ / एजेंट', role_readonly: 'सिर्फ देखने के लिए', canViewAll: 'सभी ग्राहक देख सकते हैं',
  saved: 'सेव हुआ', business: 'व्यवसाय', preview: 'झलक', reminderDays: 'रिमाइंडर के दिन', reminderDaysHelp: 'समाप्ति से पहले के दिन; बाद के 1 दिन के लिए -1',
  error_generic: 'कुछ गड़बड़ हुई। फिर से कोशिश करें।', error_offline: 'आप ऑफलाइन हैं। सेव डेटा दिख रहा है।',
  error_invalid_credentials: 'मोबाइल या पासवर्ड गलत है', error_mobile_taken: 'यह मोबाइल पहले से रजिस्टर है',
  error_rate_limited: 'बहुत ज़्यादा फेच। एक मिनट रुकें।', error_vehicle_exists: 'यह वाहन पहले से जुड़ा है',
  error_read_only: 'आपका खाता सिर्फ देखने के लिए है',
};

const mr = {
  appName: 'वाहन सेवा केंद्र', name: 'नाव', tagline: 'वाहनांची कागदपत्रे आणि नूतनीकरण, एकाच ठिकाणी',
  nav_dashboard: 'होम', nav_due: 'ड्यू यादी', nav_customers: 'ग्राहक', nav_add: 'जोडा', nav_reports: 'अहवाल',
  login: 'लॉग इन', logout: 'लॉग आउट', register: 'खाते तयार करा', mobile: 'मोबाईल नंबर', password: 'पासवर्ड',
  businessName: 'व्यवसायाचे नाव', yourName: 'तुमचे नाव', city: 'गाव / शहर', haveAccount: 'आधीच खाते आहे? लॉग इन करा',
  noAccount: 'नवीन आहात? खाते तयार करा', trialNote: '15 दिवस मोफत ट्रायल. कार्डची गरज नाही.',
  save: 'सेव्ह करा', cancel: 'रद्द करा', edit: 'बदला', delete: 'काढून टाका', back: 'मागे', loading: 'लोड होत आहे…', retry: 'पुन्हा',
  search: 'शोधा', searchPlaceholder: 'नाव, मोबाईल, गाडी नंबर, पॉलिसी नंबर, चेसिस नंबर',
  noResults: 'काहीही सापडले नाही', optional: 'ऐच्छिक', required: 'आवश्यक',
  greeting: 'नमस्कार', customers: 'ग्राहक', vehicles: 'वाहने', remindersPending: 'बाकी रिमाइंडर',
  rcCredits: 'RC क्रेडिट', rcFetchesMonth: 'या महिन्यातील RC फेच',
  expired: 'संपलेले', due7: '≤ 7 दिवस', due15: '8–15 दिवस', due30: '16–30 दिवस', active: 'चालू',
  todaysCalls: 'आजची कॉल यादी', noCalls: 'आज कोणालाही कॉल करायचा नाही. छान!',
  call: 'कॉल', whatsapp: 'व्हॉट्सॲप', daysLeft: '{n} दिवस बाकी', dueToday: 'आज संपते', expiredAgo: '{n} दिवसांपूर्वी संपले',
  expiresOn: '{d} रोजी संपते', docStatus: 'स्थितीनुसार कागदपत्रे',
  dueList: 'ड्यू यादी', bulkMode: 'सर्वांना एकामागून एक पाठवा', markSent: 'पाठवले', skip: 'वगळा', sent: 'पाठवलेले',
  queueEmpty: 'कोणतेही रिमाइंडर बाकी नाहीत. यादी रोज सकाळी 8 वाजता तयार होते.', pending: 'बाकी', next: 'पुढील',
  bulkProgress: '{n} पैकी {i}', bulkDone: 'सर्व रिमाइंडर पूर्ण!', openWhatsapp: 'व्हॉट्सॲप उघडा', noWhatsapp: 'व्हॉट्सॲप नंबर नाही',
  addCustomer: 'ग्राहक जोडा', customerName: 'ग्राहकाचे नाव', whatsappNo: 'व्हॉट्सॲप नंबर', altNo: 'दुसरा नंबर',
  sameAsMobile: 'मोबाईलप्रमाणेच', language: 'भाषा', tags: 'टॅग', notes: 'नोंदी', referredBy: 'कोणाच्या ओळखीने',
  tag_fleet: 'फ्लीट मालक', tag_walkin: 'वॉक-इन', tag_reference: 'ओळखीचे', address: 'पत्ता',
  fleet: '{n} वाहने', noCustomers: 'अजून ग्राहक नाहीत. पहिले वाहन जोडण्यासाठी जोडा दाबा.',
  personalPolicies: 'आरोग्य आणि जीवन पॉलिसी', addPolicy: 'पॉलिसी जोडा', addVehicle: 'वाहन जोडा',
  regNo: 'गाडी नंबर', fetchDetails: 'माहिती आणा', fetching: 'VAHAN वरून माहिती येत आहे…',
  consent: 'ग्राहकाने वाहन माहिती पडताळणीसाठी संमती दिली आहे',
  consentNeeded: 'आधी संमतीच्या चौकटीत टिक करा', invalidRegNo: 'नंबर तपासा. उदाहरण: MH08AB1234',
  invalidState: 'राज्य कोड चुकीचा आहे', fetchedFrom: '{when} आणले', fromCache: 'जतन केलेली प्रत, क्रेडिट कमी झाले नाही',
  refresh: 'VAHAN वरून रिफ्रेश करा', refreshed: 'VAHAN वरून अपडेट झाले', rcNotFound: 'VAHAN मध्ये वाहन सापडले नाही. माहिती स्वतः भरा.',
  rcFailed: 'आत्ता माहिती आणता आली नाही. स्वतः भरा किंवा पुन्हा प्रयत्न करा.', manualEntry: 'स्वतः भरा',
  alreadyAdded: 'हे वाहन आधीच तुमच्या यादीत आहे.', openVehicle: 'वाहन उघडा',
  reviewDetails: 'सेव्ह करण्यापूर्वी तपासा आणि बदला', owner: 'ग्राहक (मालक)', existingCustomer: 'जुना ग्राहक',
  newCustomer: 'नवीन ग्राहक', pickCustomer: 'ग्राहक शोधा', vehicleType: 'वाहन प्रकार',
  section_owner: 'मालक', section_vehicle: 'वाहन', section_reg: 'नोंदणी', section_docs: 'सापडलेली कागदपत्रे',
  ownerName: 'मालकाचे नाव', fatherName: 'वडिलांचे नाव', presentAddress: 'सध्याचा पत्ता', permanentAddress: 'कायमचा पत्ता',
  maker: 'कंपनी', model: 'मॉडेल', variant: 'व्हेरिएंट', bodyType: 'बॉडी प्रकार', vehicleClass: 'वाहन वर्ग', fuel: 'इंधन',
  colour: 'रंग', seatingCapacity: 'आसने', grossWeight: 'GVW (किलो)', unladenWeight: 'रिकामे वजन (किलो)',
  manufacturingYear: 'उत्पादन वर्ष', registrationDate: 'नोंदणी तारीख', rcValidUpto: 'RC वैधता', chassisNo: 'चेसिस नंबर',
  engineNo: 'इंजिन नंबर', rto: 'RTO', financer: 'फायनान्सर / बोजा', rcStatus: 'RC स्थिती', blacklisted: 'ब्लॅकलिस्टेड',
  norms: 'उत्सर्जन मानक', saveVehicle: 'वाहन सेव्ह करा', savedWithDocs: 'सेव्ह झाले. {n} कागदपत्रे मुदतीसह जोडली.',
  documents: 'कागदपत्रे', history: 'जुनी', addDocument: 'कागदपत्र जोडा', rawJson: 'VAHAN मूळ डेटा', lastFetched: 'शेवटचे आणले',
  never: 'कधीच नाही',
  docType: 'कागदपत्र', number: 'नंबर', provider: 'विमा कंपनी / देणारे', startDate: 'सुरुवात तारीख', issueDate: 'दिल्याची तारीख',
  expiryDate: 'मुदत संपण्याची तारीख', amount: 'रक्कम (₹)', autoExpiry: 'आपोआप भरले, बदलू शकता', policyType: 'पॉलिसी प्रकार',
  idv: 'IDV (₹)', ncb: 'NCB %', totalPremium: 'एकूण प्रीमियम (₹)', odPremium: 'OD प्रीमियम (₹)', tpPremium: 'TP प्रीमियम (₹)',
  permitType: 'परमिट प्रकार', uploadFile: 'फोटो / PDF जोडा', files: 'फाईल्स', archived: 'जुने',
  doc_insurance: 'विमा', doc_puc: 'पीयूसी', doc_fitness: 'फिटनेस', doc_permit: 'परमिट', doc_road_tax: 'रोड टॅक्स',
  doc_green_tax: 'ग्रीन टॅक्स', doc_speed_governor: 'स्पीड गव्हर्नर', doc_vltd: 'VLTD / GPS', doc_reflective_tape: 'रिफ्लेक्टिव्ह टेप',
  doc_fastag: 'फास्टॅग', doc_rc: 'RC वैधता', doc_driving_licence: 'वाहन परवाना', doc_health: 'आरोग्य विमा', doc_life: 'जीवन विमा',
  vt_2W: 'दुचाकी', vt_car: 'कार', vt_pickup: 'पिकअप / बोलेरो', vt_dumper: 'डंपर / टिपर', vt_truck: 'ट्रक', vt_bus: 'बस',
  vt_tractor: 'ट्रॅक्टर', vt_jcb: 'JCB / मशीन', vt_auto: 'रिक्षा', vt_other: 'इतर',
  addWhat: 'काय जोडायचे आहे?', addVehicleHint: 'गाडी नंबर टाका, माहिती आपोआप येईल',
  addCustomerHint: 'नाव, मोबाईल, व्हॉट्सॲप', addPolicyHint: 'ग्राहकाचा आरोग्य किंवा जीवन विमा',
  reports: 'अहवाल', rcLog: 'RC फेच नोंद', consentLog: 'संमती नोंद', live: 'लाइव्ह', cached: 'कॅशमधून', failed: 'अयशस्वी',
  cost: 'खर्च', by: 'द्वारे', comingPhase2: 'प्रीमियम, कमिशन आणि नूतनीकरण अहवाल फेज 2 मध्ये येतील.',
  ownerOnly: 'हे फक्त मालक पाहू शकतात.',
  settings: 'सेटिंग्ज', appLanguage: 'ॲपची भाषा', darkMode: 'डार्क मोड', templates: 'व्हॉट्सॲप मेसेज टेम्पलेट',
  templateHelp: 'व्हेरिएबल: {name} {vehicle} {doc} {expiry} {agent_name} {agent_phone}', beforeExpiry: 'मुदत संपण्यापूर्वी',
  afterExpiry: 'मुदत संपल्यानंतर', resetDefault: 'मूळ मजकूर परत आणा', team: 'टीम', addMember: 'सदस्य जोडा', role: 'भूमिका',
  role_owner: 'मालक', role_staff: 'स्टाफ / एजंट', role_readonly: 'फक्त पाहण्यासाठी', canViewAll: 'सर्व ग्राहक पाहू शकतात',
  saved: 'सेव्ह झाले', business: 'व्यवसाय', preview: 'झलक', reminderDays: 'रिमाइंडरचे दिवस', reminderDaysHelp: 'मुदतीपूर्वीचे दिवस; नंतरच्या 1 दिवसासाठी -1',
  error_generic: 'काहीतरी चुकले. पुन्हा प्रयत्न करा.', error_offline: 'तुम्ही ऑफलाइन आहात. जतन केलेला डेटा दिसत आहे.',
  error_invalid_credentials: 'मोबाईल किंवा पासवर्ड चुकीचा आहे', error_mobile_taken: 'हा मोबाईल आधीच नोंदणीकृत आहे',
  error_rate_limited: 'खूप जास्त फेच. एक मिनिट थांबा.', error_vehicle_exists: 'हे वाहन आधीच जोडले आहे',
  error_read_only: 'तुमचे खाते फक्त पाहण्यासाठी आहे',
};

export const DICTS = { en: { ...en, ...phase2.en }, hi: { ...hi, ...phase2.hi }, mr: { ...mr, ...phase2.mr } };
export const LANGS = [
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'en', label: 'English' },
];

const I18nCtx = createContext(null);

function readLang() {
  try {
    return localStorage.getItem('vsk.lang') || 'mr';
  } catch {
    return 'mr';
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l) => {
    setLangState(l);
    try {
      localStorage.setItem('vsk.lang', l);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const t = useCallback((key, vars) => {
    let s = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
