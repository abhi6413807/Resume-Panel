const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const fs = require("fs");

const PDF_MIME_TYPE = "application/pdf";
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIN_TEXT_LENGTH_FOR_PDF = Number(process.env.MIN_TEXT_LENGTH_FOR_PDF || 300);
const OCR_FALLBACK_PROVIDER = (process.env.OCR_FALLBACK_PROVIDER || "none").toLowerCase();

// Extract text from PDF
async function extractTextFromPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    return data.text;
  } catch (error) {
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
}

// Extract text from DOCX
async function extractTextFromDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    throw new Error(`DOCX parsing failed: ${error.message}`);
  }
}

function cleanText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function runOcrFallback(filePath, fileType) {
  // Hook point for OCR provider integration (e.g. cloud OCR).
  if (OCR_FALLBACK_PROVIDER === "none") {
    return {
      text: "",
      provider: "none",
      warning:
        "Primary extraction returned low text and OCR fallback is not configured. Set OCR_FALLBACK_PROVIDER to enable it.",
    };
  }

  return {
    text: "",
    provider: OCR_FALLBACK_PROVIDER,
    warning: `OCR provider '${OCR_FALLBACK_PROVIDER}' is not implemented yet for ${fileType}.`,
  };
}

async function extractTextWithFallback(filePath, fileType) {
  const primaryText = await extractTextFromFile(filePath, fileType);
  const normalizedPrimaryText = cleanText(primaryText);

  const extractionMeta = {
    primaryMethod: fileType === PDF_MIME_TYPE ? "pdf-parse" : "mammoth",
    fallbackAttempted: false,
    fallbackUsed: false,
    fallbackProvider: null,
    warning: null,
    textLength: normalizedPrimaryText.length,
  };

  if (fileType !== PDF_MIME_TYPE || normalizedPrimaryText.length >= MIN_TEXT_LENGTH_FOR_PDF) {
    return { text: primaryText, extractionMeta };
  }

  extractionMeta.fallbackAttempted = true;
  const fallbackResult = await runOcrFallback(filePath, fileType);
  extractionMeta.fallbackProvider = fallbackResult.provider;
  extractionMeta.warning = fallbackResult.warning || null;

  const fallbackText = cleanText(fallbackResult.text);
  if (fallbackText.length > normalizedPrimaryText.length) {
    extractionMeta.fallbackUsed = true;
    extractionMeta.textLength = fallbackText.length;
    return { text: fallbackResult.text, extractionMeta };
  }

  return { text: primaryText, extractionMeta };
}

// Extract text from file (PDF or DOCX)
async function extractTextFromFile(filePath, fileType) {
  if (fileType === PDF_MIME_TYPE) {
    return await extractTextFromPdf(filePath);
  } else if (fileType === DOCX_MIME_TYPE) {
    return await extractTextFromDocx(filePath);
  } else {
    throw new Error("Unsupported file type. Use PDF or DOCX.");
  }
}

// Parse candidate data from extracted text
function parseCandidateData(text) {
  // Initialize candidate object
  const candidate = {
    fullName: "",
    email: "",
    phone: "",
    roleApplied: "",
    totalExperience: 0,
    currentCompany: "",
    expectedCTC: "",
    currentLocation: "",
    summary: "",
    skills: [],
  };

  // Clean raw text lines
  const rawLines = text.split("\n").map((line) => line.trim());

  // Extract email (pattern: xxx@xxx.xxx with optional spaces inserted by PDF parsers)
  const emailRegex = /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,6}/;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    candidate.email = emailMatch[0].replace(/\s+/g, "").toLowerCase();
  }

  // Extract phone (matches common formats: +91 9876543210, +91-98765-43210, 09876543210, 9876543210, etc.)
  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{2,5}[-.\s]?\d{2,6}/g;
  const phoneMatches = text.match(phoneRegex) || [];
  for (const match of phoneMatches) {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) {
      candidate.phone = match.trim();
      break;
    }
  }
  // Fallback to the original matching if above didn't find anything
  if (!candidate.phone) {
    const phoneMatch = text.match(/(?:\+91[-.\s]?|0)?[6-9]\d{9}/);
    if (phoneMatch) {
      candidate.phone = phoneMatch[0].replace(/[-.\s]/g, "");
    }
  }

  // Extract name (filter out common template words and look at the first few lines)
  const nameIgnoredKeywords = [
    "resume", "curriculum vitae", "cv", "page", "portfolio", "summary", "profile",
    "contact", "email", "phone", "address", "about me", "experience", "education"
  ];
  let foundName = "";
  for (let i = 0; i < Math.min(rawLines.length, 5); i++) {
    const line = String(rawLines[i] || "").trim();
    if (line.length < 3 || line.length > 50) continue;
    if (nameIgnoredKeywords.some(kw => line.toLowerCase().includes(kw))) continue;
    if (line.includes("@") || line.includes("http") || line.match(/\d/)) continue;
    if (line.startsWith("--") || line.endsWith("--")) continue;
    foundName = line;
    break;
  }
  candidate.fullName = foundName || (rawLines.find(l => l.length > 0) || "").substring(0, 100);

  // Extract experience (look for patterns like "3 years", "5+ years", etc.)
  const expPatterns = [
    /(\d+)\+?\s*(?:years?|yrs?|y\.?)\s*(?:of\s+)?experience/i,
    /experience\s*[:\-]?\s*(\d+)\+?\s*(?:years?|yrs?)/i,
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?work/i
  ];
  for (const pattern of expPatterns) {
    const expMatch = text.match(pattern);
    if (expMatch) {
      candidate.totalExperience = parseInt(expMatch[1]) || 0;
      break;
    }
  }

  // Extract skills (look for "Skills:", "Technical Skills:" etc.)
  const skillsMatch = text.match(
    /(?:skills?|technical\s+skills?|expertise|technologies?|skills\s+include)[:\-]{0,2}\s*([^\.]+?)(?=\n|[A-Z][a-z]+:|$)/i
  );
  let extractedSkills = [];
  if (skillsMatch) {
    const skillsText = skillsMatch[1];
    extractedSkills = skillsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length < 50 && !s.endsWith("&") && !s.endsWith("-") && !s.toLowerCase().includes("learning") && !s.toLowerCase().includes("experience") && !s.toLowerCase().includes("knowledge"));
  }

  // Scan text for common skills to enrich the list
  const COMMON_SKILLS = [
    "React", "Node", "Express", "JavaScript", "TypeScript", "HTML", "CSS", "PHP", 
    "Laravel", "MySQL", "MongoDB", "Python", "Java", "C++", "C#", "Docker", "Git", 
    "AWS", "SQL", "PostgreSQL", "Angular", "Vue", "jQuery", "Bootstrap", "Tailwind", 
    "Django", "Flask", "Spring", "Flutter", "React Native"
  ];
  
  const keywordSkills = COMMON_SKILLS.filter(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    return regex.test(text);
  });

  candidate.skills = [...new Set([...extractedSkills, ...keywordSkills])].slice(0, 15);

  // Extract location (look for "Location:", "Based in:", etc.)
  const locationMatch = text.match(/(?:location|based|city)[:\-]{0,2}\s*([^\.`,\n]+)/i);
  if (locationMatch) {
    candidate.currentLocation = locationMatch[1].trim().substring(0, 100);
  }

  // Extract current company (look for "Currently at:", "Company:", etc.)
  const companyMatch = text.match(
    /(?:currently\s+(?:at|working\s+at)|company|current\s+employer)[:\-]{0,2}\s*([^\.`,\n]+)/i
  );
  if (companyMatch) {
    candidate.currentCompany = companyMatch[1].trim().substring(0, 100);
  }

  // Extract expected salary/CTC
  const ctcMatch = text.match(/(?:expected|ctc|salary)[:\s]*(?:rs|₹)?\s*([0-9,\.]+)\s*(?:lpa|per\s+annum)?/i);
  if (ctcMatch) {
    candidate.expectedCTC = ctcMatch[1].trim();
  }

  // Extract summary (first substantial paragraph)
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter((p) => p.length > 30 && !p.includes("@") && !p.match(/\d{3,}/) && !p.toLowerCase().includes("resume") && !p.toLowerCase().includes("curriculum vitae"));
  if (paragraphs.length > 0) {
    candidate.summary = paragraphs[0].substring(0, 500);
  }

  // Try to detect role applied from text
  const commonRoles = [
    "Developer",
    "Engineer",
    "Manager",
    "Designer",
    "Analyst",
    "Architect",
    "Lead",
    "Senior",
    "Junior",
  ];
  const roleMatch = text.match(
    new RegExp(`(?:${commonRoles.join("|")})\\s+(?:Engineer|Developer|Manager|Designer)?`, "i")
  );
  if (roleMatch) {
    candidate.roleApplied = roleMatch[0].trim();
  }

  const fieldConfidence = {
    fullName: candidate.fullName ? 0.65 : 0,
    email: candidate.email ? 0.95 : 0,
    phone: candidate.phone ? 0.9 : 0,
    roleApplied: candidate.roleApplied ? 0.55 : 0,
    totalExperience: candidate.totalExperience > 0 ? 0.75 : 0,
    currentCompany: candidate.currentCompany ? 0.6 : 0,
    expectedCTC: candidate.expectedCTC ? 0.5 : 0,
    currentLocation: candidate.currentLocation ? 0.6 : 0,
    summary: candidate.summary ? (candidate.summary.length > 80 ? 0.65 : 0.45) : 0,
    skills:
      candidate.skills.length > 0
        ? Math.min(0.9, 0.4 + candidate.skills.length * 0.08)
        : 0,
  };

  const scores = Object.values(fieldConfidence);
  const total = scores.reduce((sum, score) => sum + score, 0);
  const overallConfidence = Number((total / scores.length).toFixed(2));

  return {
    candidate,
    confidence: {
      overall: overallConfidence,
      fields: fieldConfidence,
    },
  };
}

module.exports = {
  extractTextFromFile,
  extractTextWithFallback,
  parseCandidateData,
  PDF_MIME_TYPE,
  DOCX_MIME_TYPE,
};
