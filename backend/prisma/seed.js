const bcrypt = require("bcrypt");
const prisma = require("../prisma");

const CASE_NUMBER_SETTING_KEY = "CASE_NUMBER_CONFIG";
const DEFAULT_CASE_PATTERN = "[YYYY]-[SEQ3]";
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "Demo123!";
const BOOTSTRAP_ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@nextact.local")
  .trim()
  .toLowerCase();

function normalizeCasePattern(pattern) {
  return String(pattern || "").trim();
}

function getInitials(value) {
  const normalized = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!normalized.length) {
    return "";
  }

  return normalized
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function generateCaseNumber(pattern, sequence, context = {}) {
  const now = new Date();
  const fullYear = String(now.getFullYear());
  const shortYear = fullYear.slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const rawSequence = String(sequence);
  const paddedSequence3 = String(sequence).padStart(3, "0");
  const paddedSequence4 = String(sequence).padStart(4, "0");

  return normalizeCasePattern(pattern)
    .replaceAll("[YYYY]", fullYear)
    .replaceAll("[YY]", shortYear)
    .replaceAll("[MM]", month)
    .replaceAll("[DD]", day)
    .replaceAll("[SEQ4]", paddedSequence4)
    .replaceAll("[SEQ3]", paddedSequence3)
    .replaceAll("[SEQ]", rawSequence)
    .replaceAll("[L_INIT]", context.lawyerInitials || "")
    .replaceAll("[C_INIT]", context.clientInitials || "");
}

async function upsertClient(data) {
  const existing = await prisma.client.findFirst({
    where: { full_name: data.full_name }
  });

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.client.create({ data });
}

async function upsertUser(data) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: data,
    create: data
  });
}

async function seedDemoData() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const acmeClient = await upsertClient({
    full_name: "Bergmann Immobilien GmbH",
    email: "kontakt@bergmann-immobilien.de",
    phone: "+49 30 555 1200",
    address: "Friedrichstrasse 110",
    zip_code: "10117",
    city: "Berlin",
    state: "Berlin"
  });

  const nordlichtClient = await upsertClient({
    full_name: "Nordlicht Handels AG",
    email: "recht@nordlicht-handels.de",
    phone: "+49 40 777 2300",
    address: "Speicherstadt 8",
    zip_code: "20457",
    city: "Hamburg",
    state: "Hamburg"
  });

  const demirClient = await upsertClient({
    full_name: "Familie Demir",
    email: "familie.demir@example.com",
    phone: "+49 211 888 4455",
    address: "Rheinufer 22",
    zip_code: "40213",
    city: "Duesseldorf",
    state: "Nordrhein-Westfalen"
  });

  const adminUser = await prisma.user.findUnique({
    where: { email: BOOTSTRAP_ADMIN_EMAIL }
  });

  const annaLawyer = await upsertUser({
    username: "anna.keller",
    full_name: "Anna Keller",
    email: "anna.keller@nextact.local",
    password_hash: passwordHash,
    role: "lawyer",
    is_approved: true,
    client_id: null
  });

  const marcLawyer = await upsertUser({
    username: "marc.weber",
    full_name: "Marc Weber",
    email: "marc.weber@nextact.local",
    password_hash: passwordHash,
    role: "lawyer",
    is_approved: true,
    client_id: null
  });

  const lisaAssistant = await upsertUser({
    username: "lisa.hoffmann",
    full_name: "Lisa Hoffmann",
    email: "lisa.hoffmann@nextact.local",
    password_hash: passwordHash,
    role: "assistant",
    is_approved: true,
    client_id: null
  });

  const tobiasAssistant = await upsertUser({
    username: "tobias.neumann",
    full_name: "Tobias Neumann",
    email: "tobias.neumann@nextact.local",
    password_hash: passwordHash,
    role: "assistant",
    is_approved: true,
    client_id: null
  });

  await upsertUser({
    username: "portal.acme",
    full_name: "Portal Acme",
    email: "portal.acme@nextact.local",
    password_hash: passwordHash,
    role: "client",
    is_approved: true,
    client_id: acmeClient.id
  });

  await upsertUser({
    username: "portal.demir",
    full_name: "Portal Demir",
    email: "portal.demir@nextact.local",
    password_hash: passwordHash,
    role: "client",
    is_approved: true,
    client_id: demirClient.id
  });

  const casePatternSetting = await prisma.systemSetting.upsert({
    where: { setting_key: CASE_NUMBER_SETTING_KEY },
    update: {},
    create: {
      setting_key: CASE_NUMBER_SETTING_KEY,
      pattern: DEFAULT_CASE_PATTERN,
      current_sequence: 0
    }
  });

  const existingCaseCount = await prisma.case.count();
  if (existingCaseCount > 0) {
    console.log("Demo seed skipped case creation because cases already exist.");
    return;
  }

  const pattern = casePatternSetting.pattern || DEFAULT_CASE_PATTERN;
  let sequence = casePatternSetting.current_sequence || 0;

  const demoCases = [
    {
      name: "Prüfung Gewerbemietvertrag",
      client: acmeClient,
      owner: annaLawyer,
      status: "Active",
      deadline: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 12),
      short_description: "Prüfung eines neuen Gewerbemietvertrags inklusive Sonderkuendigungsrechten.",
      assignees: [lisaAssistant],
      placeholders: [
        { name: "Unterschriebener Vertragsentwurf", status: "Pending" },
        { name: "Grundbuchauszug", status: "Pending" }
      ]
    },
    {
      name: "Markenanmeldung Nordlicht",
      client: nordlichtClient,
      owner: marcLawyer,
      status: "Active",
      deadline: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 21),
      short_description: "Markenanmeldung und Kollisionsprüfung fuer eine neue Handelsmarke.",
      assignees: [lisaAssistant, tobiasAssistant],
      placeholders: [
        { name: "Markendarstellung", status: "Pending" },
        { name: "Waren- und Dienstleistungsklassen", status: "Pending" }
      ]
    },
    {
      name: "Nachlassplanung Familie Demir",
      client: demirClient,
      owner: annaLawyer,
      status: "On Hold",
      deadline: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 30),
      short_description: "Erstellung einer Nachlassplanung und Vorbereitung der Unterlagen fuer das Familiengespraech.",
      assignees: [tobiasAssistant],
      placeholders: [
        { name: "Ausweiskopien", status: "Pending" },
        { name: "Vermögensuebersicht", status: "Pending" }
      ]
    },
    {
      name: "Interne Compliance-Prüfung",
      client: nordlichtClient,
      owner: adminUser || marcLawyer,
      status: "Active",
      deadline: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 7),
      short_description: "Kurzfristige Compliance-Prüfung interner Arbeits- und Beschaffungsprozesse.",
      assignees: [marcLawyer, lisaAssistant],
      placeholders: [
        { name: "Richtlinienhandbuch", status: "Pending" },
        { name: "Muster Lieferantenvertrag", status: "Pending" }
      ]
    }
  ];

  for (const item of demoCases) {
    sequence += 1;
    const caseNumber = generateCaseNumber(pattern, sequence, {
      lawyerInitials: getInitials(item.owner?.full_name || item.owner?.username || ""),
      clientInitials: getInitials(item.client.full_name || "")
    });

    const createdCase = await prisma.case.create({
      data: {
        name: item.name,
        case_number: caseNumber,
        client_id: item.client.id,
        owner_id: item.owner?.id || null,
        status: item.status.toLowerCase(),
        deadline: item.deadline,
        short_description: item.short_description
      }
    });

    for (const assignee of item.assignees) {
      await prisma.caseAssignment.upsert({
        where: {
          case_id_user_id: {
            case_id: createdCase.id,
            user_id: assignee.id
          }
        },
        update: {},
        create: {
          case_id: createdCase.id,
          user_id: assignee.id
        }
      });
    }

    await prisma.casePlaceholder.createMany({
      data: item.placeholders.map((placeholder) => ({
        case_id: createdCase.id,
        name: placeholder.name,
        status: placeholder.status,
        attached_files: []
      }))
    });
  }

  await prisma.systemSetting.update({
    where: { setting_key: CASE_NUMBER_SETTING_KEY },
    data: {
      pattern,
      current_sequence: sequence
    }
  });

  console.log("Demo seed completed with employees, clients, assignments, and cases.");
}

if (require.main === module) {
  seedDemoData()
    .catch((error) => {
      console.error("Demo seed failed:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedDemoData };
