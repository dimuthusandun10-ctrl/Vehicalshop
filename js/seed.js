/* =====================================================
   js/seed.js - Initial Seed Data for Firebase & Local fallback
   ===================================================== */

var INITIAL_PRODUCTS = [
  {
    id: 'P01', code: 'BP-1001', name: 'බ්රේක් පෑඩ්', nameEn: 'Brake Pad - Toyota Axio', cat: 'Brake',
    brand: 'Toyota', model: 'Axio / Fielder', oemNo: '04465-02220',
    altNos: ['Akebono AN-688K', 'Tokico TN-401', 'Advics SN-135', '0986AB1234'],
    chassis: ['NZE141', 'NZE144', 'NZE161', 'ZRE142'], engine: ['1NZ-FE', '2ZR-FE'],
    yearFrom: 2006, yearTo: 2018, rack: 'A-01', bin: 'B1', warehouse: 'Main',
    cost: 3500, price: 4800, priceWholesale: 4200, qty: 24, reorder: 5, unit: 'set',
    warranty: 6, hasSerial: false, coreDeposit: 0, crossSell: ['OF-2002', 'AF-2003'], active: true
  },
  {
    id: 'P02', code: 'OF-2002', name: 'තෙල් පෙරනය', nameEn: 'Oil Filter - Nissan Sunny', cat: 'Filter',
    brand: 'Nissan', model: 'Sunny / Wingroad / Tiida', oemNo: '15208-65F0A',
    altNos: ['Bosch 0986452041', 'Vic C-224', 'Sakura C-1823'],
    chassis: ['N16', 'B15', 'Y11', 'Y12', 'C11'], engine: ['QG13', 'QG15', 'HR15DE'],
    yearFrom: 2000, yearTo: 2016, rack: 'B-02', bin: 'B4', warehouse: 'Main',
    cost: 850, price: 1350, priceWholesale: 1100, qty: 40, reorder: 10, unit: 'pcs',
    warranty: 0, hasSerial: false, coreDeposit: 0, crossSell: ['AF-2003'], active: true
  },
  {
    id: 'P03', code: 'AF-2003', name: 'වායු පෙරනය', nameEn: 'Air Filter - Honda Fit / Vezel', cat: 'Filter',
    brand: 'Honda', model: 'Fit / Vezel / Grace', oemNo: '17220-5R0-008',
    altNos: ['Sakura A-90180', 'Vic A-899'],
    chassis: ['GP5', 'GP6', 'RU3', 'GM4'], engine: ['LEB-H1', 'L15B'],
    yearFrom: 2013, yearTo: 2021, rack: 'B-02', bin: 'B5', warehouse: 'Main',
    cost: 1200, price: 1900, priceWholesale: 1600, qty: 3, reorder: 6, unit: 'pcs',
    warranty: 0, hasSerial: false, coreDeposit: 0, crossSell: ['OF-2002'], active: true
  },
  {
    id: 'P04', code: 'SP-3004', name: 'ස්පාර්ක් ප්ලග්', nameEn: 'Spark Plug - NGK Iridium', cat: 'Electrical',
    brand: 'NGK', model: 'Universal / Laser Iridium', oemNo: 'ILKAR7B11',
    altNos: ['Denso IXEH22TT'],
    chassis: ['NZE141', 'GP5', 'ZVW30'], engine: ['1NZ-FE', '2ZR-FXE'],
    yearFrom: 2008, yearTo: 2025, rack: 'D-01', bin: 'B2', warehouse: 'Main',
    cost: 950, price: 1500, priceWholesale: 1250, qty: 60, reorder: 15, unit: 'pcs',
    warranty: 12, hasSerial: false, coreDeposit: 0, crossSell: [], active: true
  },
  {
    id: 'P05', code: 'CP-4005', name: 'ක්ලච් ප්ලේට්', nameEn: 'Clutch Plate - Suzuki Alto', cat: 'Engine',
    brand: 'Suzuki', model: 'Alto / Wagon R', oemNo: '22400-M68K00',
    altNos: ['Exedy SZD048U'],
    chassis: ['HA25', 'HA36', 'MH23S'], engine: ['K10B', 'R06A'],
    yearFrom: 2009, yearTo: 2020, rack: 'E-03', bin: 'B1', warehouse: 'Main',
    cost: 8500, price: 12500, priceWholesale: 10500, qty: 4, reorder: 3, unit: 'set',
    warranty: 6, hasSerial: false, coreDeposit: 0, crossSell: [], active: true
  },
  {
    id: 'P06', code: 'SA-5006', name: 'ෂොක් ඇබ්සෝබර්', nameEn: 'Shock Absorber Front - Toyota', cat: 'Suspension',
    brand: 'Toyota', model: 'Corolla 141 / Axio', oemNo: '48510-80415',
    altNos: ['KYB 339114', 'Tokico B3232'],
    chassis: ['NZE141', 'ZRE142'], engine: ['1NZ-FE', '2ZR-FE'],
    yearFrom: 2006, yearTo: 2013, rack: 'F-01', bin: 'L1', warehouse: 'Main',
    cost: 6200, price: 8900, priceWholesale: 7800, qty: 8, reorder: 4, unit: 'pcs',
    warranty: 12, hasSerial: true, coreDeposit: 0, crossSell: [], active: true
  },
  {
    id: 'P07', code: 'BT-8009', name: 'වාහන බැටරි', nameEn: 'Car Battery 55Ah Maintenance Free', cat: 'Electrical',
    brand: 'Amaron', model: 'Universal / Hi-Life Pro', oemNo: '28800-YZZ01',
    altNos: ['Exide Matrix 55', 'Lucas 55Ah'],
    chassis: [], engine: [],
    yearFrom: 2000, yearTo: 2026, rack: 'C-03', bin: 'B2', warehouse: 'Main',
    cost: 22000, price: 28500, priceWholesale: 26000, qty: 6, reorder: 3, unit: 'pcs',
    warranty: 24, hasSerial: true, coreDeposit: 2000, crossSell: [], active: true
  },
  {
    id: 'P08', code: 'HL-6007', name: 'හෙඩ් ලයිට් බල්බ්', nameEn: 'Head Light Bulb H4 12V 60/55W', cat: 'Electrical',
    brand: 'Philips', model: 'Universal', oemNo: '90981-13058',
    altNos: ['Osram 64193', 'Koito 0456'],
    chassis: [], engine: [],
    yearFrom: 1995, yearTo: 2026, rack: 'D-02', bin: 'B1', warehouse: 'Main',
    cost: 650, price: 1100, priceWholesale: 900, qty: 35, reorder: 10, unit: 'pcs',
    warranty: 3, hasSerial: false, coreDeposit: 0, crossSell: [], active: true
  },
  {
    id: 'P09', code: 'WB-7008', name: 'වයිපර් බ්ලේඩ්', nameEn: 'Wiper Blade 18" Premium', cat: 'Body',
    brand: 'Bosch', model: 'Universal', oemNo: '3397011400',
    altNos: ['Denso DU-045L'],
    chassis: [], engine: [],
    yearFrom: 2000, yearTo: 2026, rack: 'D-03', bin: 'B3', warehouse: 'Main',
    cost: 1100, price: 1750, priceWholesale: 1400, qty: 2, reorder: 8, unit: 'pcs',
    warranty: 1, hasSerial: false, coreDeposit: 0, crossSell: [], active: true
  },
  {
    id: 'P10', code: 'SM-1011', name: 'සයිඩ් මිරර්', nameEn: 'Side Mirror Door Glass - Nissan Leaf', cat: 'Body',
    brand: 'Nissan', model: 'Leaf AZE0', oemNo: '96366-3NA0A',
    altNos: [],
    chassis: ['ZE0', 'AZE0'], engine: ['EM57'],
    yearFrom: 2011, yearTo: 2017, rack: 'G-02', bin: 'B1', warehouse: 'Main',
    cost: 4500, price: 6800, priceWholesale: 5800, qty: 1, reorder: 2, unit: 'pcs',
    warranty: 0, hasSerial: false, coreDeposit: 0, crossSell: [], active: true
  }
];

var INITIAL_CUSTOMERS = [
  { id: 'C01', name: 'කමල් පෙරේරා', phone: '0771234567', vehicle: 'CAB-1234', points: 120, creditLimit: 50000, creditBalance: 0 },
  { id: 'C02', name: 'නිමල් සිල්වා', phone: '0712345678', vehicle: 'CBB-5678', points: 80,  creditLimit: 30000, creditBalance: 0 },
  { id: 'C03', name: 'සුනිල් ජයසිංහ', phone: '0765432190', vehicle: 'KL-9012',  points: 45,  creditLimit: 20000, creditBalance: 0 }
];

var INITIAL_SUPPLIERS = [
  { id: 'SUP01', name: 'ABC Auto Parts (Pvt) Ltd', phone: '011-2233445', address: '123, Panchikawatta, Colombo 10', contact: 'Mr. Silva', payable: 0, terms: '30 days' },
  { id: 'SUP02', name: 'Lanka Motor Traders', phone: '011-4567890', address: '45, Kandy Road, Kelaniya', contact: 'Mr. Perera', payable: 0, terms: '14 days' }
];

var INITIAL_SHOPS = [
  {
    id:        'SHOP-001',
    name:      'Auto Parts Lanka - Colombo',
    address:   'No. 25, Main Street, Colombo 11',
    phone:     '011-234 5678',
    email:     'info@autoparts.lk',
    ownerId:   'U1',
    createdAt: '2026-01-01T00:00:00.000Z',
    active:    true,
    tax:       0,
    footerEn:  'Thank you! Come again.'
  }
];

var INITIAL_USERS = [
  {
    id:          'U1',
    name:        'සුපිරි පරිපාලක',
    username:    'superadmin',
    password:    '1234',
    role:        'superadmin',
    permissions: ['billing', 'dashboard', 'pos', 'inventory', 'customers', 'lowstock', 'grn', 'returns', 'serial-search', 'shifts', 'reports', 'shops', 'profile', 'settings', 'staff', 'credit', 'discounts', 'price-override', 'void-sale', 'delete-product'],
    shopId:      null,
    active:      true,
    locked:      false,
    lockMessage: '',
    lockedBy:    null,
    lockedAt:    null,
    phone:       '0770000001',
    email:       'superadmin@autoparts.lk',
    createdAt:   '2026-01-01T00:00:00.000Z',
    createdBy:   'system'
  },
  {
    id:          'U2',
    name:        'පරිපාලක',
    username:    'admin',
    password:    '1234',
    role:        'admin',
    permissions: ['billing', 'dashboard', 'pos', 'inventory', 'customers', 'lowstock', 'grn', 'returns', 'serial-search', 'shifts', 'reports', 'settings', 'staff', 'profile', 'credit', 'discounts', 'price-override', 'void-sale', 'delete-product'],
    shopId:      'SHOP-001',
    active:      true,
    locked:      false,
    lockMessage: '',
    lockedBy:    null,
    lockedAt:    null,
    phone:       '0770000002',
    email:       'admin@autoparts.lk',
    createdAt:   '2026-01-05T00:00:00.000Z',
    createdBy:   'U1'
  },
  {
    id:          'U3',
    name:        'කැෂියර්',
    username:    'cashier',
    password:    '1234',
    role:        'cashier',
    permissions: ['billing', 'dashboard', 'customers', 'lowstock', 'profile'],
    shopId:      'SHOP-001',
    active:      true,
    locked:      false,
    lockMessage: '',
    lockedBy:    null,
    lockedAt:    null,
    phone:       '0770000003',
    email:       'cashier@autoparts.lk',
    createdAt:   '2026-01-15T00:00:00.000Z',
    createdBy:   'U2'
  }
];

async function seedIfEmpty(){
  if(!window.FB) return false;
  if(window.FB.isPermissionDenied && window.FB.isPermissionDenied()) return false;

  try {
    const existing = await window.FB.fbGetAll(window.FB.COL.products);
    if(window.FB.isPermissionDenied && window.FB.isPermissionDenied()) return false;
    if(existing && existing.length > 0) return false;

    for(const sh of INITIAL_SHOPS) await window.FB.fbSet(window.FB.COL.shops, sh.id, sh);
    for(const u of INITIAL_USERS) await window.FB.fbSet(window.FB.COL.users, u.id, u);
    for(const p of INITIAL_PRODUCTS) await window.FB.fbSet(window.FB.COL.products, p.id, p);
    for(const c of INITIAL_CUSTOMERS) await window.FB.fbSet(window.FB.COL.customers, c.id, c);
    for(const s of INITIAL_SUPPLIERS) await window.FB.fbSet(window.FB.COL.suppliers, s.id, s);
    await window.FB.fbSet(window.FB.COL.settings, 'shop', {
      name: 'Auto Parts Lanka - Colombo', addr: 'No. 25, Main Street, Colombo 11',
      phone: '011-234 5678', tax: 0, footer: 'ස්තූතියි! නැවත එන්න.'
    });
    return true;
  } catch(e) {
    return false;
  }
}

window.INITIAL_SHOPS = INITIAL_SHOPS;
window.INITIAL_PRODUCTS = INITIAL_PRODUCTS;
window.INITIAL_CUSTOMERS = INITIAL_CUSTOMERS;
window.INITIAL_SUPPLIERS = INITIAL_SUPPLIERS;
window.INITIAL_USERS = INITIAL_USERS;
window.seedIfEmpty = seedIfEmpty;
