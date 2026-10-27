/** Builds a small valid one-page PDF whose text layer holds `lines`. */
export function makePdf(lines) {
  const escape = (s) => s.replace(/[\\()]/g, (m) => `\\${m}`);
  const content = ["BT", "/F1 11 Tf", "14 TL", "50 780 Td", ...lines.map((l) => `(${escape(l)}) '`), "ET"].join(
    "\n",
  );
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export const RESUME_LINES = [
  "Asha Rao - Full-stack developer",
  "asha.rao@example.com | +91 98765 43210 | github.com/asharao",
  "Summary: Developer who builds fast web apps with React and Node.js.",
  "Education: B.Tech Computer Science, City Institute of Technology, 2020 - 2024",
  "Experience: Software Engineer Intern, Acme Corp, June 2024 - December 2024",
  "Built REST APIs in Express and reduced p95 latency by 30 percent.",
  "Skills: JavaScript, TypeScript, React, Express, PostgreSQL, Redis, Docker",
  "Projects: ShopLite - an e-commerce store using React, Node and Redis caching.",
  "Projects: ChatNow - a realtime chat app with WebSockets and MongoDB.",
  "Certifications: AWS Cloud Practitioner",
];

export const INVOICE_LINES = [
  "INVOICE #2024-117",
  "Bill to: Northwind Traders, 42 Market Street",
  "Item: Office chairs x 12 ............ 1,440.00",
  "Item: Standing desks x 4 ............ 2,000.00",
  "Subtotal 3,440.00   Tax 619.20   Total due 4,059.20",
  "Payment terms: net 30 days. Thank you for your business, we appreciate it greatly.",
  "Remit payment to the bank account listed on the reverse of this page please.",
];

export const PROFILE = {
  name: "Asha Rao",
  headline: "Full-stack developer",
  yearsOfExperience: 0.5,
  primaryDomain: "web",
  skills: {
    languages: ["JavaScript", "TypeScript"],
    frameworks: ["React", "Express"],
    databases: ["PostgreSQL", "Redis"],
    tools: ["Docker"],
    cloud: [],
    other: [],
  },
  projects: [
    {
      name: "ShopLite",
      role: "Solo developer",
      description: "An e-commerce store with product pages cached in Redis.",
      stack: ["React", "Node", "Redis"],
      highlights: ["Cached product pages and invalidated keys on update"],
    },
    {
      name: "ChatNow",
      role: null,
      description: "A realtime chat app using WebSockets.",
      stack: ["WebSockets", "MongoDB"],
      highlights: [],
    },
  ],
  experience: [
    {
      company: "Acme Corp",
      title: "Software Engineer Intern",
      start: "2024-06",
      end: "2024-12",
      highlights: ["Built REST APIs in Express", "Reduced p95 latency by 30 percent"],
    },
  ],
  education: [
    { institution: "City Institute of Technology", degree: "B.Tech", field: "Computer Science", start: "2020", end: "2024" },
  ],
  certifications: ["AWS Cloud Practitioner"],
};

/** Deterministic bag-of-words embedding so similar words land near each other in 384-d space. */
export function fakeEmbedding(text) {
  const vector = new Array(384).fill(0);
  for (const word of String(text).toLowerCase().match(/[a-z]{3,}/g) ?? []) {
    let hash = 0;
    for (const ch of word) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    vector[hash % 384] += 1;
  }
  const norm = Math.sqrt(vector.reduce((s, x) => s + x * x, 0)) || 1;
  return vector.map((x) => x / norm);
}

/** A fetch Response-like object with a streaming body. */
export function driveResponse({ status = 200, headers = {}, body = Buffer.alloc(0) }) {
  return new Response(status === 204 || status === 302 ? null : body, { status, headers });
}
