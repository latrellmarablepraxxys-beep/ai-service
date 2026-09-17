import type {
  MockAiResponseTemplate,
  MockBranch,
  MockEscalationTopic,
  MockKnowledgeEntry,
  MockMotorcycle,
  MockMotorcycleVariant,
  MockPromotion,
} from '../interfaces/mockAdminApi.js';

/**
 * Seed data mirroring the admin's seeded state:
 * - branches: the 3 concrete `MenuFlowSeeder` rows verbatim + 3 plausible PH branches
 * - motorcycles: the admin seeds none, so a realistic PH model set
 * - ai-response-templates: the 6 `AiResponseTemplateSeeder` rows verbatim
 */
export const MOCK_BRANCHES: readonly MockBranch[] = [
  {
    id: 1,
    code: 'HQ',
    name: 'Head Office',
    address: 'National Headquarters',
    status: 1,
    enable_ai_assist: true,
    page_name: null,
  },
  {
    id: 2,
    code: 'BGC',
    name: 'BGC Showroom',
    address: 'Bonifacio Global City, Taguig',
    status: 1,
    enable_ai_assist: true,
    page_name: null,
  },
  {
    id: 3,
    code: 'MKT',
    name: 'Makati Branch',
    address: 'Makati City, Metro Manila',
    status: 1,
    enable_ai_assist: true,
    page_name: null,
  },
  {
    id: 4,
    code: 'CEB',
    name: 'Cebu City Branch',
    address: 'Cebu City, Cebu',
    status: 1,
    enable_ai_assist: true,
    page_name: null,
  },
  {
    id: 5,
    code: 'DAV',
    name: 'Davao Branch',
    address: 'Davao City, Davao del Sur',
    status: 1,
    enable_ai_assist: true,
    page_name: null,
  },
  {
    id: 6,
    code: 'QC',
    name: 'Quezon City Branch',
    address: 'Quezon City, Metro Manila',
    status: 0,
    enable_ai_assist: false,
    page_name: null,
  },
];

export const MOCK_MOTORCYCLES: readonly MockMotorcycle[] = [
  {
    id: 1,
    name: 'Honda Click 125i',
    code: 'H-CLICK125I',
    brand: 'HONDA',
    status: 0,
    variant_type: 'STD',
    srp: 82_000,
    description: 'A fuel-efficient automatic scooter for daily commuting.',
    image_url: null,
  },
  {
    id: 2,
    name: 'Honda Click 160',
    code: 'H-CLICK160',
    brand: 'HONDA',
    status: 0,
    variant_type: 'STD',
    srp: 89_900,
    description: 'The bigger-displacement Click with more power and comfort.',
    image_url: null,
  },
  {
    id: 3,
    name: 'Honda PCX160',
    code: 'H-PCX160',
    brand: 'HONDA',
    status: 0,
    variant_type: 'ABS',
    srp: 138_000,
    description: 'Premium automatic scooter with ABS and smart key.',
    image_url: null,
  },
  {
    id: 4,
    name: 'Honda ADV160',
    code: 'H-ADV160',
    brand: 'HONDA',
    status: 0,
    variant_type: 'ABS',
    srp: 159_000,
    description: 'Adventure-styled scooter built for mixed roads.',
    image_url: null,
  },
  {
    id: 5,
    name: 'Honda CB500X',
    code: 'H-CB500X',
    brand: 'HONDA',
    status: 0,
    variant_type: 'STD',
    srp: 429_000,
    description: 'A reliable adventure motorcycle for long rides.',
    image_url: null,
  },
  {
    id: 6,
    name: 'Yamaha MT-15',
    code: 'Y-MT15',
    brand: 'YAMAHA',
    status: 0,
    variant_type: 'STD',
    srp: 120_000,
    description: 'Aggressive naked street bike with VVA engine.',
    image_url: null,
  },
  {
    id: 7,
    name: 'Yamaha NMAX 155',
    code: 'Y-NMAX155',
    brand: 'YAMAHA',
    status: 0,
    variant_type: 'ABS',
    srp: 145_000,
    description: 'Maxi-scooter with ABS, smart key, and ample storage.',
    image_url: null,
  },
  {
    id: 8,
    name: 'Yamaha Aerox 155',
    code: 'Y-AEROX155',
    brand: 'YAMAHA',
    status: 2,
    variant_type: 'ABS',
    srp: 132_000,
    description: 'Sporty automatic scooter with a liquid-cooled engine.',
    image_url: null,
  },
  {
    id: 9,
    name: 'Suzuki Burgman Street',
    code: 'S-BURGMAN',
    brand: 'SUZUKI',
    status: 0,
    variant_type: 'STD',
    srp: 78_900,
    description: 'Comfortable and practical city scooter.',
    image_url: null,
  },
  {
    id: 10,
    name: 'Kawasaki Rouser NS160',
    code: 'K-NS160',
    brand: 'KAWASAKI',
    status: 1,
    variant_type: 'STD',
    srp: 95_000,
    description: 'Sporty commuter motorcycle with a 160cc engine.',
    image_url: null,
  },
  {
    id: 11,
    name: 'Honda Click 125',
    code: 'H-CLICK125',
    brand: 'HONDA',
    status: 0,
    variant_type: null,
    srp: 0,
    description: 'Honda Click 125 — available in V4 STD and V4 SE.',
    image_url: null,
  },
];

export const MOCK_AI_RESPONSE_TEMPLATES: readonly MockAiResponseTemplate[] = [
  {
    id: 1,
    title: 'Welcome Message',
    content: "Hi! Welcome to Motorcentral! 🎉 I'm your virtual assistant. How can I help you today? You can ask about our products, check order status, or I can connect you with a human agent.",
    type: 1,
  },
  {
    id: 2,
    title: 'Greeting (Returning Customer)',
    content: "Welcome back! 👋 I see you've chatted with us before. How can I assist you today?",
    type: 1,
  },
  {
    id: 3,
    title: "When AI doesn't know the answer",
    content: "I'm sorry, I don't have enough information to answer that question. Let me connect you with one of our team members who can help!",
    type: 2,
  },
  {
    id: 4,
    title: 'When query is irrelevant / off-topic',
    content: "I'm here to help with Motorcentral-related inquiries! 😊 Could you please ask me something about our products, services, or your account?",
    type: 2,
  },
  {
    id: 5,
    title: 'When escalation to human agent is needed',
    content: "I've transferred your conversation to one of our team members. They'll be with you shortly! In the meantime, feel free to share any additional details.",
    type: 2,
  },
  {
    id: 6,
    title: 'Off-Hours / No agents available',
    content: 'Our team is currently offline. Our operating hours are 9:00 AM — 6:00 PM (PH Time). I can still help with basic inquiries, or you can leave a message for our team.',
    type: 2,
  },
];

export const MOCK_KNOWLEDGE_ENTRIES: readonly MockKnowledgeEntry[] = [
  {
    id: 1,
    key: 'greeting.initial',
    title: 'Greeting — Initial (Taglish)',
    content: 'Good day Kaibigan! Welcome po sa {{branch_page}}. Ako po ay isang *Virtual AI Agent* ng Motorcentral. Ano po ang aking maitutulong? 🎉',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 2,
    key: 'greeting.initial_en',
    title: 'Greeting — Initial (English)',
    content: 'Good day! Welcome to Motorcentral. I am a *Virtual AI Agent* of Motorcentral. How may I help you?',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 3,
    key: 'pricing.ask_payment_type',
    title: 'Pricing — Ask payment type',
    content: 'Salamat po! Gusto niyo po bang malaman ang installment o cash price?',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 4,
    key: 'pricing.ask_variant',
    title: 'Pricing — Ask variant',
    content: 'Mayroon po kaming dalawang version ng {{product_name}}. Alin po sa mga ito ang gusto niyo?\n\n{{variant_list}}',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 5,
    key: 'price.format.installment',
    title: 'Price format — Installment',
    content: '🏍 {{product_name}} {{variant_name}}\n💵 Minimum Downpayment: {{min_downpayment}}\n📅 Installment Terms:\n{{terms_lines}}\n🎁 Less {{updated_payment_less}} monthly for updated payment.\n\n{{freebies_question}}',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 6,
    key: 'price.format.cash',
    title: 'Price format — Cash',
    content: '🏍 {{product_name}} {{variant_name}}\n💰 Cash Price: {{cash_price}}\n\n{{freebies_question}}',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 7,
    key: 'freebies.installment',
    title: 'Freebies — Installment pointer',
    content: 'Quote the installment freebie package from the current INSTALLMENT promotion, then list Kaibigan Card partner merchants.',
    content_type: 2,
    version: 1,
    is_current: true,
  },
  {
    id: 8,
    key: 'freebies.cash',
    title: 'Freebies — Cash pointer',
    content: 'Quote the cash freebie package from the current CASH promotion, then list Kaibigan Card partner merchants.',
    content_type: 2,
    version: 1,
    is_current: true,
  },
  {
    id: 9,
    key: 'freebies.bajaj',
    title: 'Freebies — Bajaj pointer',
    content: 'Quote the Bajaj freebie package from the current BAJAJ promotion, then list Kaibigan Card partner merchants.',
    content_type: 2,
    version: 1,
    is_current: true,
  },
  {
    id: 10,
    key: 'freebies.kaibigan_merchants',
    title: 'Freebies — Kaibigan Card merchants',
    content: '🏍 Motoworld - Sta. Rosa, Laguna\n🏍 Motomart - Boac, Marinduque\n🏍 Motoking Prime Helmet - Dasmariñas and Silang, Cavite\n💈 Riyoshi Barbershop - Calamba, Laguna\n☕ Musikape - Biñan, Laguna\n☕ Cafe Lounge - San Pedro, Laguna\n🥂 SkyPiea Rooftop Bar and Kitchenette - Tagaytay',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 11,
    key: 'freebies.question',
    title: 'Freebies — Offer question',
    content: 'Gusto niyo po bang malaman ang mga kasamang freebies?',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 12,
    key: 'application.jotform_link',
    title: 'Application — JOT Form link',
    content: 'Maaari niyo pong i-click ang link na ibibigay ng aming team member o mag-message sa aming Messenger para sa inyong application. Narito ang online application form:\nhttps://form.jotform.com/241562824952461',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 13,
    key: 'ids.accepted',
    title: 'Accepted IDs (placeholder — replace with admin list)',
    content: "Driver's License, UMID, PhilSys National ID, Passport, Voter's ID, Postal ID, PRC ID",
    content_type: 3,
    version: 1,
    is_current: true,
  },
  {
    id: 14,
    key: 'fallback.general',
    title: 'Fallback — General',
    content: 'Pasensya na po — pakiulit po ang inyong tanong, o ikokonekta ko po kayo sa aming team member na makakatulong.',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 15,
    key: 'fallback.escalation',
    title: 'Fallback — Escalation',
    content: 'Salamat po sa inyong tanong. Ikokonekta ko po kayo sa aming team member na makakatulong po sa inyo.',
    content_type: 1,
    version: 1,
    is_current: true,
  },
  {
    id: 16,
    key: 'scenario.requirements_1',
    title: 'Scenario — Requirements 1 (pending)',
    content: 'PENDING: full scenario text to be provided by the business team.',
    content_type: 2,
    version: 1,
    is_current: false,
  },
  {
    id: 17,
    key: 'scenario.requirements_2',
    title: 'Scenario — Requirements 2 (pending)',
    content: 'PENDING: full scenario text to be provided by the business team.',
    content_type: 2,
    version: 1,
    is_current: false,
  },
];

export const MOCK_ESCALATION_TOPICS: readonly MockEscalationTopic[] = [
  {
    id: 1,
    key: 'BIG_DOWNPAYMENT',
    label: 'Big Downpayment',
    keywords: [
      'big downpayment',
      'downpayment computation',
      'compute downpayment',
      'malaking downpayment'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 2,
    key: 'CREDIT_CARD',
    label: 'Credit Card',
    keywords: [
      'credit card',
      'creditcard',
      'cc payment',
      'credit card computation'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 3,
    key: 'PAYMENT_711',
    label: '711 Payment',
    keywords: [
      '711',
      '7-11',
      'seven eleven'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 4,
    key: 'GCASH_PAYMENT',
    label: 'GCash Payment',
    keywords: [
      'gcash',
      'g-cash',
      'gcash payment'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 5,
    key: 'GGIVES',
    label: 'GGives',
    keywords: [
      'ggives',
      'g-gives'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 6,
    key: 'MONTHLY_PAYMENT',
    label: 'Monthly Payment',
    keywords: [
      'monthly payment',
      'monthly computation',
      'computation monthly',
      'magkano monthly'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 7,
    key: 'DISCOUNT',
    label: 'Discount',
    keywords: [
      'discount',
      'discounted',
      'less',
      'bawas',
      'tawad'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 8,
    key: 'BAYAD_ONLINE',
    label: 'Online Payment',
    keywords: [
      'bayad sa online',
      'online payment',
      'bayad online'
    ],
    department: 'FINANCE',
    priority: 'MEDIUM',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 9,
    key: 'ORCR',
    label: 'OR/CR',
    keywords: [
      'or/cr',
      'orcr',
      'or cr',
      'certificate of registration',
      'official receipt',
      'rehistro',
      'rehistro ng motor'
    ],
    department: 'REGISTRATION',
    priority: 'HIGH',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 10,
    key: 'PLATE',
    label: 'Plate',
    keywords: [
      'plate',
      'plaka',
      'plate number',
      'temporary plate'
    ],
    department: 'REGISTRATION',
    priority: 'HIGH',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 11,
    key: 'ACCIDENT',
    label: 'Accident',
    keywords: [
      'accident',
      'aksidente',
      'nabangga',
      'bangga',
      'damage claim'
    ],
    department: 'SERVICE',
    priority: 'HIGH',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
  {
    id: 12,
    key: 'ORCR_PLATE_DOCUMENTS',
    label: 'ORCR/Plate/Documents',
    keywords: [
      'orcr/plate/documents',
      'documents',
      'orcr plate'
    ],
    department: 'REGISTRATION',
    priority: 'HIGH',
    fallback_template_key: 'fallback.escalation',
    is_active: true,
  },
];

export const MOCK_PROMOTIONS: readonly MockPromotion[] = [
  {
    id: 1,
    name: 'Installment Freebies',
    applicability: 'installment',
    items: [
      {
        body: '✅ Free Motorcentral Half Face Helmet.',
        sort_order: 1,
      },
      {
        body: '✅ Free Kaibigan Service Plus Worth 40,000 (Para sa Damage ng Inyong Motor)',
        sort_order: 2,
      },
      {
        body: '✅ Free Initial LTO Registration for 3 Years and TPL Insurance',
        sort_order: 3,
      },
      {
        body: '✅ Plate holder with cover bolt',
        sort_order: 4,
      },
      {
        body: '✅ Free Service Coupon',
        sort_order: 5,
      },
      {
        body: '✅ Free basic tools',
        sort_order: 6,
      },
      {
        body: '✅ 1 Year Warranty',
        sort_order: 7,
      },
      {
        body: '✅ We Offer Genuine Spareparts.',
        sort_order: 8,
      },
      {
        body: '✅ Well Trained Mechanic for your Service.',
        sort_order: 9,
      },
      {
        body: '✅ Free Kaibigan Discount CARD (DISCOUNT sa Oil, Spareparts and Labor).',
        sort_order: 10,
      }
    ],
    is_current: true,
  },
  {
    id: 2,
    name: 'Cash Freebies',
    applicability: 'cash',
    items: [
      {
        body: '✅ Free Initial LTO Registration for 3 Years and TPL Insurance',
        sort_order: 1,
      },
      {
        body: '✅ Plate holder with cover bolt',
        sort_order: 2,
      },
      {
        body: '✅ Free Service Coupon',
        sort_order: 3,
      },
      {
        body: '✅ Free basic tools',
        sort_order: 4,
      },
      {
        body: '✅ 1 Year Warranty',
        sort_order: 5,
      },
      {
        body: '✅ We Offer Genuine Spareparts.',
        sort_order: 6,
      },
      {
        body: '✅ Well Trained Mechanic for your Service.',
        sort_order: 7,
      },
      {
        body: '✅ Free "Kaibigan CARD" (DISCOUNT sa Oil, Spareparts and Labor).',
        sort_order: 8,
      }
    ],
    is_current: true,
  },
  {
    id: 3,
    name: 'Bajaj RE Freebies (Bajaj RE / Maxima Z / Cargo)',
    applicability: 'bajaj',
    items: [
      {
        body: '✅ Free Initial LTO Registration for 3 Years and TPL Insurance',
        sort_order: 1,
      },
      {
        body: '✅ Free "Kaibigan CARD"',
        sort_order: 2,
      },
      {
        body: '✅ Temporary Plate',
        sort_order: 3,
      },
      {
        body: '✅ Plate holder with cover bolt',
        sort_order: 4,
      },
      {
        body: '✅ Free Service Coupon',
        sort_order: 5,
      },
      {
        body: '✅ Free basic tools',
        sort_order: 6,
      },
      {
        body: '✅ Warranty',
        sort_order: 7,
      },
      {
        body: '✅ 1 Liter of Gas (For start-up)',
        sort_order: 8,
      },
      {
        body: '✅ Extra Tire',
        sort_order: 9,
      }
    ],
    is_current: true,
  },
];

export const MOCK_MOTORCYCLE_VARIANTS: readonly MockMotorcycleVariant[] = [
  {
    id: 101,
    motorcycle_id: 11,
    name: 'V4 STD',
    code: 'H-CLICK125-V4STD',
    image_url: 'https://cdn.motorcentral.ph/products/click125-v4-std.png',
    cash_price: 84_850,
    min_downpayment: 6_700,
    updated_payment_less: 200,
    terms: [
      {
        term_months: 12,
        monthly_amount: 9_105,
      },
      {
        term_months: 24,
        monthly_amount: 5_395,
      },
      {
        term_months: 36,
        monthly_amount: 4_250,
      }
    ],
  },
  // Unpriced until the admin publishes SE catalog data; exercises the no-data path.
  {
    id: 102,
    motorcycle_id: 11,
    name: 'V4 SE',
    code: 'H-CLICK125-V4SE',
    image_url: 'https://cdn.motorcentral.ph/products/click125-v4-se.png',
    cash_price: null,
    min_downpayment: null,
    updated_payment_less: null,
    terms: [],
  },
];
