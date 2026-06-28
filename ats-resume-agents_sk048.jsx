import { useState, useRef, useCallback } from "react";

// ─── Agent Definitions ────────────────────────────────────────────────
const AGENTS = {
  scanner: {
    id: "scanner", name: "Agent SCAN", role: "ATS Keyword Scanner", avatar: "🔍",
    color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE",
    description: "Parses resume structure, extracts keywords, checks ATS compatibility",
    step: 1,
  },
  format: {
    id: "format", name: "Agent FORMAT", role: "Format & Structure Checker", avatar: "📐",
    color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC",
    description: "Checks formatting, bullet points, section length & readability",
    step: 2,
  },
  gaps: {
    id: "gaps", name: "Agent GAPS", role: "Skill Gap Detector", avatar: "🧠",
    color: "#D97706", bg: "#FFFBEB", border: "#FDE68A",
    description: "Detects missing skills, suggests certifications & learning paths",
    step: 3,
  },
  match: {
    id: "match", name: "Agent MATCH", role: "Job Description Matcher", avatar: "🎯",
    color: "#059669", bg: "#ECFDF5", border: "#A7F3D0",
    description: "Matches your resume against a job description for fit score",
    step: 4,
  },
  rewrite: {
    id: "rewrite", name: "Agent REWRITE", role: "ATS Content Rewriter", avatar: "✍️",
    color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE",
    description: "Rewrites summary & experience bullets to be ATS-optimized",
    step: 5,
  },
  scorer: {
    id: "scorer", name: "Agent SCORE", role: "Final Scorer & Grader", avatar: "📊",
    color: "#DB2777", bg: "#FDF2F8", border: "#FBCFE8",
    description: "Aggregates all agent reports and produces final ATS score & grade",
    step: 6,
  },
};

// ─── Prompts ──────────────────────────────────────────────────────────
// NOTE: Resume is sliced to 1500 chars max per agent to prevent JSON truncation.
// Each prompt uses a system message pattern + minimal schema to stay under token limits.

function makePrompt(role, schema, data) {
  return `You are ${role}.
CRITICAL: Respond with ONLY a single valid JSON object. No markdown. No explanation. No text before or after. Just JSON.
The response must start with { and end with }.

Return this exact JSON structure with real values filled in:
${JSON.stringify(schema)}

Data to analyze:
${data}`;
}

const RESUME_LIMIT = 1500;

const PROMPTS = {
  scanner: (resume) => makePrompt(
    "Agent SCAN — ATS Keyword Scanner",
    {
      headline: { text: "job title or name+role", headlineScore: 0, headlineFeedback: "feedback" },
      keywords: { found: ["kw1","kw2","kw3"], missing: ["mk1","mk2","mk3"], keywordDensity: 0 },
      structure: { hasContactInfo: true, hasSummary: true, hasExperience: true, hasEducation: true, hasSkills: true, structureScore: 0 },
      atsCompatibility: { score: 0, issues: ["issue1","issue2"], positives: ["pos1","pos2"] },
      agentLog: ["Parsed structure","Extracted keywords","Scored compatibility"]
    },
    `RESUME:
${(resume||"").slice(0, RESUME_LIMIT)}`
  ),

  format: (resume) => makePrompt(
    "Agent FORMAT — Resume Format Checker",
    {
      formatScore: 0,
      bulletPoints: { count: 0, quality: "good|fair|poor", feedback: "feedback" },
      sectionLengths: { summary: "too short|good|too long", experience: "too short|good|too long", skills: "too short|good|too long" },
      readability: { score: 0, issues: ["issue1"], suggestions: ["suggestion1","suggestion2"] },
      lengthCheck: { verdict: "too short|ideal|too long", feedback: "feedback" },
      agentLog: ["Checked bullet points","Evaluated section lengths","Assessed readability"]
    },
    `RESUME:
${(resume||"").slice(0, RESUME_LIMIT)}`
  ),

  gaps: (resume, scan) => makePrompt(
    "Agent GAPS — Skill Gap Detector",
    {
      gapScore: 0,
      presentSkills: ["skill1","skill2","skill3","skill4"],
      missingSkills: ["skill1","skill2","skill3","skill4"],
      certifications: ["Cert Name 1 - why it helps","Cert Name 2 - why it helps"],
      suggestions: ["Actionable suggestion 1","Actionable suggestion 2","Actionable suggestion 3"],
      industryBenchmark: "One sentence comparing resume to industry standard",
      agentLog: ["Identified present skills","Detected skill gaps","Recommended certifications"]
    },
    `RESUME:
${(resume||"").slice(0, RESUME_LIMIT)}
MISSING KEYWORDS: ${(scan?.keywords?.missing||[]).slice(0,6).join(", ")}`
  ),

  match: (resume, jd) => makePrompt(
    "Agent MATCH — Job Description Matcher",
    {
      matchScore: 0,
      matchedKeywords: ["kw1","kw2","kw3"],
      missingKeywords: ["mk1","mk2","mk3"],
      sectionFit: { summary: 0, experience: 0, skills: 0 },
      verdict: "Two sentence match verdict here",
      recommendations: ["Recommendation 1","Recommendation 2","Recommendation 3"],
      agentLog: ["Parsed job description","Matched keywords","Calculated fit score"]
    },
    `RESUME:
${(resume||"").slice(0,800)}
JOB DESCRIPTION:
${(jd||"No JD provided - evaluate against general best practices").slice(0,800)}`
  ),

  rewrite: (resume, scan, gaps) => makePrompt(
    "Agent REWRITE — ATS Content Rewriter",
    {
      headlineOptions: ["ATS-optimized headline option 1","Alternative headline option 2"],
      rewrittenSummary: "Full rewritten 3-4 sentence professional summary with ATS keywords",
      rewrittenBullets: ["• Action verb + achievement + metric 1","• Action verb + achievement + metric 2","• Action verb + achievement + metric 3"],
      improvements: ["Key change made and why 1","Key change made and why 2"],
      agentLog: ["Rewrote headline","Optimized summary","Enhanced bullet points"]
    },
    `RESUME:
${(resume||"").slice(0,800)}
ADD KEYWORDS: ${(scan?.keywords?.missing||[]).slice(0,6).join(", ")}
FILL GAPS: ${(gaps?.missingSkills||[]).slice(0,5).join(", ")}`
  ),

  scorer: (scan, format, gaps, match, rewrite) => makePrompt(
    "Agent SCORE — Final ATS Scorer",
    {
      overallScore: 0,
      overallGrade: "A|B|C|D|F",
      breakdown: { keywords: 0, format: 0, skills: 0, jobMatch: 0, content: 0 },
      topStrengths: ["Strength 1","Strength 2","Strength 3"],
      topImprovements: ["Priority fix 1","Priority fix 2","Priority fix 3"],
      verdict: "Two sentence final verdict for a hiring manager",
      atsReadiness: "ATS Ready|Needs Work|Not Ready",
      agentLog: ["Aggregated all scores","Calculated final grade","Generated verdict"]
    },
    `SCAN_SCORE:${scan?.atsCompatibility?.score||0} FORMAT_SCORE:${format?.formatScore||0} GAP_SCORE:${gaps?.gapScore||0} MATCH_SCORE:${match?.matchScore||0}
ISSUES: ${[...(scan?.atsCompatibility?.issues||[]), ...(format?.readability?.issues||[])].slice(0,4).join("; ")}
MISSING_SKILLS: ${(gaps?.missingSkills||[]).slice(0,5).join(", ")}
STRENGTHS: ${(scan?.atsCompatibility?.positives||[]).slice(0,3).join("; ")}`
  ),
};

// ─── Claude API ───────────────────────────────────────────────────────
function extractJSON(raw) {
  // Try fence-wrapped JSON first
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : raw;
  // Find outermost { ... }
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(src.slice(start, end + 1));
}

async function callClaude(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const raw = data.content?.map(b => b.text || "").join("") || "";
      return extractJSON(raw);
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
}

// ─── File extraction via Claude document API ──────────────────────────
async function extractText(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "txt") return file.text();
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });
  const mediaType = ext === "pdf" ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6", max_tokens: 4000,
      messages: [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: "Extract all text from this resume. Return only the raw text, no commentary." }
      ]}]
    }),
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  const data = await response.json();
  return data.content?.map(b => b.text || "").join("").trim() || "";
}

// ─── UI Components ────────────────────────────────────────────────────
function AgentCard({ agent, status, log }) {
  const s = { idle: { label: "Standby", dot: "#9CA3AF" }, running: { label: "Working…", dot: "#F59E0B" }, done: { label: "Done ✓", dot: "#10B981" }, error: { label: "Error", dot: "#EF4444" } }[status] || { label: "Standby", dot: "#9CA3AF" };
  return (
    <div style={{ border: `1.5px solid ${status === "done" ? agent.color + "66" : agent.border}`, borderRadius: 12, background: status === "running" ? agent.bg : status === "done" ? agent.bg : "#1E293B", padding: "14px 16px", transition: "all 0.3s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: status === "idle" ? "#334155" : agent.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: `1px solid ${status === "idle" ? "#475569" : agent.border}` }}>{agent.avatar}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: status === "idle" ? "#94A3B8" : agent.color }}>{agent.name}</div>
          <div style={{ fontSize: 10, color: "#64748B" }}>Step {agent.step} · {agent.role}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, boxShadow: status === "running" ? `0 0 0 3px ${s.dot}44` : "none" }} />
          <span style={{ fontSize: 10, color: s.dot, fontWeight: 600 }}>{s.label}</span>
        </div>
      </div>
      <p style={{ fontSize: 11, color: status === "idle" ? "#475569" : "#6B7280", margin: "0 0 6px", lineHeight: 1.4 }}>{agent.description}</p>
      {log?.length > 0 && (
        <div style={{ background: "#0F172A", borderRadius: 6, padding: "6px 8px", fontSize: 10, color: "#94A3B8", lineHeight: 1.6, maxHeight: 56, overflowY: "auto" }}>
          {log.map((l, i) => <div key={i}>▸ {l}</div>)}
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score, size = 72, color = "#2563EB" }) {
  const r = (size - 10) / 2, circ = 2 * Math.PI * r, filled = (score / 100) * circ;
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  const gc = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#334155" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: size * 0.18, fontWeight: 700, color: gc }}>{grade}</span>
      </div>
    </div>
  );
}

function MiniScore({ label, score, color }) {
  const c = color || (score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444");
  return (
    <div style={{ textAlign: "center", padding: "10px 14px", background: "#0F172A", borderRadius: 10, border: "1px solid #334155" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{score}</div>
      <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Tag({ text, color = "#2563EB", bg = "#DBEAFE" }) {
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99, display: "inline-block", margin: "2px" }}>{text}</span>;
}

function Section({ title, children }) {
  return (
    <div style={{ background: "#1E293B", border: "1.5px solid #334155", borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────
export default function ATSAgents() {
  const [resumeText, setResumeText] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileStatus, setFileStatus] = useState("idle");
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showJD, setShowJD] = useState(false);
  const [agentStatus, setAgentStatus] = useState(Object.fromEntries(Object.keys(AGENTS).map(k => [k, "idle"])));
  const [agentLogs, setAgentLogs] = useState(Object.fromEntries(Object.keys(AGENTS).map(k => [k, []])));
  const [results, setResults] = useState({});
  const [phase, setPhase] = useState("input");
  const [runError, setRunError] = useState("");
  const [currentAgent, setCurrentAgent] = useState(null);
  const fileInputRef = useRef(null);
  const resultRef = useRef(null);

  const setAStatus = (a, s) => setAgentStatus(p => ({ ...p, [a]: s }));
  const setALog = (a, l) => setAgentLogs(p => ({ ...p, [a]: l }));

  // Run a single agent and update UI state
  async function runAgent(id, prompt) {
    setAStatus(id, "running");
    setALog(id, ["Initializing…", "Calling Claude API…"]);
    try {
      const result = await callClaude(prompt);
      if (!result || typeof result !== "object") throw new Error("Invalid response");
      setALog(id, result.agentLog || ["Complete."]);
      setAStatus(id, "done");
      setResults(p => ({ ...p, [id]: result }));
      return result;
    } catch (e) {
      setAStatus(id, "error");
      setALog(id, ["Failed: " + e.message]);
      throw new Error(`Agent ${id.toUpperCase()} failed: ${e.message}`);
    }
  }

  async function runAllAgents() {
    if (!resumeText.trim()) { setRunError("Please upload a resume first."); return; }
    setRunError("");
    setPhase("running");
    setResults({});
    Object.keys(AGENTS).forEach(k => { setAStatus(k, "idle"); setALog(k, []); });

    try {
      // ── Round 1: SCAN + FORMAT in parallel (no dependencies) ──
      const [scan, format] = await Promise.all([
        runAgent("scanner", PROMPTS.scanner(resumeText)),
        runAgent("format",  PROMPTS.format(resumeText)),
      ]);

      // ── Round 2: GAPS + MATCH in parallel (both need SCAN) ────
      const [gaps, match] = await Promise.all([
        runAgent("gaps",  PROMPTS.gaps(resumeText, scan)),
        runAgent("match", PROMPTS.match(resumeText, jobDesc)),
      ]);

      // ── Round 3: REWRITE (needs SCAN + GAPS) ──────────────────
      const rewrite = await runAgent("rewrite", PROMPTS.rewrite(resumeText, scan, gaps));

      // ── Round 4: SCORE (needs everything) ─────────────────────
      await runAgent("scorer", PROMPTS.scorer(scan, format, gaps, match, rewrite));

      setCurrentAgent(null);
      setPhase("results");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setRunError("An agent failed: " + e.message);
      setPhase("input");
      setCurrentAgent(null);
    }
  }

  function processFile(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf","txt","docx"].includes(ext)) { setFileError("Upload a PDF, DOCX, or TXT file."); setFileStatus("error"); return; }
    setFileError(""); setFileName(file.name); setResumeText(""); setFileStatus("loading");
    extractText(file)
      .then(text => { if (text.length < 30) throw new Error("File appears empty."); setResumeText(text); setFileStatus("ready"); })
      .catch(e => { setFileError(e.message); setFileStatus("error"); setFileName(""); });
  }

  const onFileChange = e => { processFile(e.target.files?.[0]); e.target.value = ""; };
  const onDrop = useCallback(e => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files?.[0]); }, []);
  const onDragOver = e => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  function reset() {
    setPhase("input"); setResumeText(""); setFileName(""); setFileStatus("idle");
    setFileError(""); setRunError(""); setResults({}); setJobDesc(""); setCurrentAgent(null);
    Object.keys(AGENTS).forEach(k => { setAStatus(k, "idle"); setALog(k, []); });
  }

  const canRun = resumeText.trim().length > 0 && phase !== "running";

  // ── DOCX Download ─────────────────────────────────────────────────
  const [docxLoading, setDocxLoading] = useState(false);

  async function loadDocxLib() {
    if (window.docx) return window.docx;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js";
      s.onload = () => resolve(window.docx);
      s.onerror = () => reject(new Error("Failed to load docx library"));
      document.head.appendChild(s);
    });
  }

  async function downloadDocx() {
    setDocxLoading(true);
    try {
      const {
        Document, Packer, Paragraph, TextRun, HeadingLevel,
        AlignmentType, LevelFormat, BorderStyle
      } = await loadDocxLib();

      const score = r.scorer?.overallScore || 0;
      const grade = r.scorer?.overallGrade || "N/A";
      const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      const divider = new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "7C3AED", space: 1 } },
        spacing: { after: 160 },
        children: []
      });

      const h = (text, level = HeadingLevel.HEADING_2) =>
        new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, bold: true })] });

      const p = (text, opts = {}) =>
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, ...opts })] });

      const bullet = (text) =>
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: text.replace(/^[•\-]\s*/, "") })]
        });

      const children = [
        // Title
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "ATS-Optimized Resume", bold: true, size: 36, color: "1E1B4B" })]
        }),
        p(`Generated on ${now} · ATS Score: ${score}/100 (Grade: ${grade})`, { color: "6B7280", size: 20 }),
        divider,

        // Headline Options
        h("✨ Rewritten Headlines", HeadingLevel.HEADING_2),
        ...(r.rewrite?.headlineOptions || []).map((hl, i) =>
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `Option ${i + 1}: `, bold: true, color: "7C3AED" }),
              new TextRun({ text: hl })
            ]
          })
        ),
        divider,

        // Summary
        h("📝 Professional Summary", HeadingLevel.HEADING_2),
        p(r.rewrite?.rewrittenSummary || ""),
        divider,

        // Experience Bullets
        h("💼 ATS-Optimized Experience Bullets", HeadingLevel.HEADING_2),
        ...(r.rewrite?.rewrittenBullets || []).map(b => bullet(b)),
        divider,

        // Improvements
        h("🔧 Key Improvements Made", HeadingLevel.HEADING_2),
        ...(r.rewrite?.improvements || []).map(imp => p(`• ${imp}`)),
        divider,

        // ATS Score Breakdown
        h("📊 ATS Score Breakdown", HeadingLevel.HEADING_2),
        p(`Overall Score: ${score}/100 · Grade: ${grade}`, { bold: true }),
        p(r.scorer?.verdict || ""),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
        ...Object.entries(r.scorer?.breakdown || {}).map(([k, v]) =>
          p(`${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}/100`)
        ),
        divider,

        // Top Improvements
        h("🎯 Priority Improvements", HeadingLevel.HEADING_2),
        ...(r.scorer?.topImprovements || []).map((tip, i) =>
          p(`${i + 1}. ${tip}`)
        ),
        divider,

        // Missing Keywords
        h("🔑 Missing ATS Keywords to Add", HeadingLevel.HEADING_2),
        p((r.scanner?.keywords?.missing || []).join(" · ") || "None identified"),
        divider,

        // Skill Gaps
        h("🧠 Skill Gaps to Address", HeadingLevel.HEADING_2),
        ...(r.gaps?.missingSkills || []).map(s => bullet(s)),
        ...(r.gaps?.certifications || []).map(c => p(`📜 ${c}`, { color: "D97706" })),

        // Footer
        new Paragraph({ spacing: { before: 400, after: 0 }, children: [new TextRun({ text: "Generated by ATS Resume Validator · 6-Agent AI Pipeline", color: "9CA3AF", size: 18, italics: true })] }),
      ];

      const doc = new Document({
        styles: {
          default: { document: { run: { font: "Arial", size: 22 } } },
          paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
              run: { size: 36, bold: true, font: "Arial", color: "1E1B4B" },
              paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
              run: { size: 26, bold: true, font: "Arial", color: "2563EB" },
              paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
          ]
        },
        numbering: {
          config: [{
            reference: "bullets",
            levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
          }]
        },
        sections: [{
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
            }
          },
          children
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ATS_Resume_${now.replace(/,?\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("DOCX download failed: " + e.message);
    } finally {
      setDocxLoading(false);
    }
  }
  const r = results;
  const totalDone = Object.values(agentStatus).filter(s => s === "done").length;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 60%, #0F172A 100%)", fontFamily: "'Inter','Segoe UI',sans-serif", padding: "28px 16px" }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "linear-gradient(135deg,#2563EB,#DB2777)", borderRadius: 12, padding: "8px 12px", fontSize: 22 }}>⚡</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#F8FAFC" }}>ATS Resume Validator</h1>
            <p style={{ margin: 0, fontSize: 12, color: "#94A3B8" }}>6 specialized AI agents · Full pipeline validation</p>
          </div>
          {phase === "running" && (
            <div style={{ marginLeft: "auto", background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "#94A3B8" }}>
              Agent {totalDone + 1}/6 running…
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Agent Pipeline Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {Object.values(AGENTS).map(agent => (
            <AgentCard key={agent.id} agent={agent} status={agentStatus[agent.id]} log={agentLogs[agent.id]} />
          ))}
        </div>

        {/* Pipeline progress bar */}
        {phase === "running" && (
          <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748B", marginBottom: 6 }}>
              <span>⚡ Parallel Pipeline</span><span>{totalDone}/6 · {totalDone < 2 ? "Round 1: SCAN+FORMAT" : totalDone < 4 ? "Round 2: GAPS+MATCH" : totalDone < 5 ? "Round 3: REWRITE" : totalDone < 6 ? "Round 4: SCORE" : "✓ Done!"}</span>
            </div>
            <div style={{ height: 6, background: "#334155", borderRadius: 99 }}>
              <div style={{ height: "100%", width: `${(totalDone / 6) * 100}%`, background: "linear-gradient(90deg,#2563EB,#DB2777)", borderRadius: 99, transition: "width 0.5s ease" }} />
            </div>
          </div>
        )}

        {/* Upload Panel */}
        {phase !== "results" && (
          <div style={{ background: "#1E293B", border: "1.5px solid #334155", borderRadius: 16, padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 12 }}>📎 Upload Resume</div>

            <div onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${isDragging ? "#2563EB" : fileStatus === "ready" ? "#10B981" : fileStatus === "error" ? "#EF4444" : "#475569"}`, borderRadius: 12, padding: "30px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: isDragging ? "#1E3A5F" : fileStatus === "ready" ? "#0F2A1E" : "#0F172A" }}>
              {fileStatus === "loading" && <div style={{ color: "#94A3B8", fontSize: 13 }}>⏳ Reading file…</div>}
              {fileStatus === "ready" && (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>{fileName}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>{resumeText.length.toLocaleString()} chars · Click to change</div>
                </div>
              )}
              {(fileStatus === "idle" || fileStatus === "error") && (
                <div>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", marginBottom: 4 }}>Drop your resume here</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: 10 }}>or click to browse · PDF, DOCX, TXT</div>
                  <div style={{ display: "inline-flex", gap: 6 }}>
                    {["PDF","DOCX","TXT"].map(t => <span key={t} style={{ background: "#334155", border: "1px solid #475569", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>{t}</span>)}
                  </div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={onFileChange} style={{ display: "none" }} />
            {fileError && <div style={{ marginTop: 8, fontSize: 12, color: "#F87171" }}>⚠ {fileError}</div>}

            {/* Optional JD */}
            <div style={{ marginTop: 14 }}>
              <button onClick={() => setShowJD(!showJD)} style={{ background: "none", border: "none", color: "#64748B", fontSize: 12, cursor: "pointer", padding: 0, fontWeight: 600 }}>
                {showJD ? "▼" : "▶"} {showJD ? "Hide" : "Add"} Job Description (optional — boosts Agent MATCH)
              </button>
              {showJD && (
                <textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)}
                  placeholder="Paste the job description here for a match score…"
                  style={{ width: "100%", marginTop: 8, minHeight: 100, padding: 12, boxSizing: "border-box", background: "#0F172A", border: "1px solid #334155", borderRadius: 10, color: "#E2E8F0", fontSize: 12, lineHeight: 1.6, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
              )}
            </div>

            {runError && <div style={{ marginTop: 10, padding: "10px 14px", background: "#3B0F0F", border: "1px solid #7F1D1D", borderRadius: 8, color: "#FCA5A5", fontSize: 12 }}>⚠ {runError}</div>}

            <button onClick={runAllAgents} disabled={!canRun}
              style={{ marginTop: 14, padding: "13px 32px", background: canRun ? "linear-gradient(135deg,#2563EB,#DB2777)" : "#1E293B", color: canRun ? "#fff" : "#475569", border: canRun ? "none" : "1.5px solid #334155", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: canRun ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
              {phase === "running" ? `⏳ ${totalDone}/6 agents done…` : "🚀 Run All 6 Agents"}
            </button>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "results" && r.scorer && (
          <div ref={resultRef}>
            {/* File bar */}
            <div style={{ background: "#1E293B", border: "1.5px solid #334155", borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span>📄</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1" }}>{fileName}</span>
              <span style={{ fontSize: 11, color: "#64748B", marginLeft: "auto" }}>{resumeText.length.toLocaleString()} chars · 6 agents</span>
            </div>

            {/* Overall Score */}
            <div style={{ background: "linear-gradient(135deg,#0F172A,#1E1B4B)", border: "1.5px solid #334155", borderRadius: 16, padding: 24, marginBottom: 16, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <ScoreRing score={r.scorer.overallScore} size={96} color="#DB2777" />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#DB2777", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Final ATS Score · 6 Agent Analysis</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#F8FAFC", marginBottom: 6 }}>{r.scorer.atsReadiness || "Needs Work"}</div>
                <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 12px", lineHeight: 1.6 }}>{r.scorer.verdict}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(r.scorer.breakdown || {}).map(([k, v]) => (
                    <MiniScore key={k} label={k.toUpperCase()} score={v} />
                  ))}
                </div>
              </div>
            </div>

            {/* Agent SCAN */}
            <Section title="🔍 Agent SCAN — Keyword & ATS Analysis">
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", marginBottom: 6 }}>ATS Headline</div>
                  <div style={{ background: "#0F172A", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#CBD5E1", fontStyle: "italic", marginBottom: 8 }}>"{r.scanner?.headline?.text || "N/A"}"</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{r.scanner?.headline?.headlineFeedback}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", marginBottom: 6 }}>Keywords Found</div>
                  <div style={{ marginBottom: 8 }}>{(r.scanner?.keywords?.found || []).slice(0,10).map((k,i) => <Tag key={i} text={k} color="#1D4ED8" bg="#DBEAFE" />)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginBottom: 4 }}>Missing Keywords</div>
                  <div>{(r.scanner?.keywords?.missing || []).slice(0,8).map((k,i) => <Tag key={i} text={k} color="#DC2626" bg="#FEE2E2" />)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                {(r.scanner?.atsCompatibility?.positives || []).map((p,i) => <div key={i} style={{ fontSize: 12, color: "#10B981" }}>✅ {p}</div>)}
                {(r.scanner?.atsCompatibility?.issues || []).map((p,i) => <div key={i} style={{ fontSize: 12, color: "#F87171" }}>⚠ {p}</div>)}
              </div>
            </Section>

            {/* Agent FORMAT */}
            <Section title="📐 Agent FORMAT — Format & Readability">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <MiniScore label="FORMAT" score={r.format?.formatScore || 0} color="#0891B2" />
                <MiniScore label="READABILITY" score={r.format?.readability?.score || 0} color="#0891B2" />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 12, color: "#CBD5E1", marginBottom: 4 }}>📏 Length: <span style={{ color: "#10B981" }}>{r.format?.lengthCheck?.verdict || "N/A"}</span></div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{r.format?.lengthCheck?.feedback}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(r.format?.readability?.suggestions || []).map((s,i) => <div key={i} style={{ fontSize: 12, color: "#94A3B8" }}>💡 {s}</div>)}
              </div>
            </Section>

            {/* Agent GAPS */}
            <Section title="🧠 Agent GAPS — Skill Gap Analysis">
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#D97706", marginBottom: 6 }}>Missing Skills</div>
                  <div style={{ marginBottom: 12 }}>{(r.gaps?.missingSkills || []).map((k,i) => <Tag key={i} text={k} color="#92400E" bg="#FEF3C7" />)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981", marginBottom: 6 }}>Present Skills</div>
                  <div>{(r.gaps?.presentSkills || []).slice(0,8).map((k,i) => <Tag key={i} text={k} color="#065F46" bg="#D1FAE5" />)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#D97706", marginBottom: 8 }}>Recommended Certifications</div>
                  {(r.gaps?.certifications || []).map((c,i) => (
                    <div key={i} style={{ background: "#0F172A", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#FCD34D" }}>{c.name} <span style={{ fontSize: 10, color: c.priority === "high" ? "#F87171" : "#94A3B8", fontWeight: 400 }}>({c.priority})</span></div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{c.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
              {r.gaps?.industryBenchmark && <div style={{ marginTop: 10, fontSize: 12, color: "#94A3B8", borderTop: "1px solid #334155", paddingTop: 10 }}>📊 {r.gaps.industryBenchmark}</div>}
            </Section>

            {/* Agent MATCH */}
            <Section title="🎯 Agent MATCH — Job Description Match">
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                <ScoreRing score={r.match?.matchScore || 0} size={72} color="#059669" />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, color: "#CBD5E1", marginBottom: 10, lineHeight: 1.6 }}>{r.match?.verdict}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981", marginBottom: 4 }}>Matched Keywords</div>
                  <div style={{ marginBottom: 8 }}>{(r.match?.matchedKeywords || []).map((k,i) => <Tag key={i} text={k} color="#065F46" bg="#D1FAE5" />)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginBottom: 4 }}>Missing from JD</div>
                  <div>{(r.match?.missingKeywords || []).map((k,i) => <Tag key={i} text={k} color="#DC2626" bg="#FEE2E2" />)}</div>
                </div>
              </div>
              {(r.match?.recommendations || []).length > 0 && (
                <div style={{ marginTop: 12, borderTop: "1px solid #334155", paddingTop: 10 }}>
                  {r.match.recommendations.map((rec,i) => <div key={i} style={{ fontSize: 12, color: "#94A3B8", padding: "3px 0" }}>→ {rec}</div>)}
                </div>
              )}
            </Section>

            {/* Agent REWRITE */}
            <Section title="✍️ Agent REWRITE — ATS-Optimized Content">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", marginBottom: 6 }}>Rewritten Headline Options</div>
                {(r.rewrite?.headlineOptions || []).map((h,i) => (
                  <div key={i} style={{ background: i === 0 ? "#1E1B4B" : "#0F172A", border: `1px solid ${i === 0 ? "#7C3AED" : "#334155"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 6, fontSize: 13, color: "#E2E8F0", fontWeight: 600 }}>{h}</div>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", marginBottom: 6 }}>Rewritten Professional Summary</div>
                <div style={{ background: "#0F172A", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#CBD5E1", lineHeight: 1.7 }}>{r.rewrite?.rewrittenSummary}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", marginBottom: 6 }}>Rewritten Experience Bullets</div>
                {(r.rewrite?.rewrittenBullets || []).map((b,i) => (
                  <div key={i} style={{ background: "#0F172A", borderRadius: 6, padding: "8px 12px", marginBottom: 4, fontSize: 12, color: "#CBD5E1", lineHeight: 1.5 }}>{b}</div>
                ))}
              </div>

              {/* DOCX Download Button */}
              <div style={{ borderTop: "1px solid #334155", paddingTop: 16, marginTop: 4 }}>
                <button
                  onClick={downloadDocx}
                  disabled={docxLoading}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 22px",
                    background: docxLoading ? "#1E293B" : "linear-gradient(135deg, #7C3AED, #2563EB)",
                    color: docxLoading ? "#475569" : "#fff",
                    border: docxLoading ? "1.5px solid #334155" : "none",
                    borderRadius: 10, fontWeight: 700, fontSize: 13,
                    cursor: docxLoading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    boxShadow: docxLoading ? "none" : "0 4px 14px rgba(124,58,237,0.35)",
                  }}
                >
                  {docxLoading ? (
                    <>⏳ Generating DOCX…</>
                  ) : (
                    <><span style={{ fontSize: 16 }}>📥</span> Download Rewritten Resume as DOCX</>
                  )}
                </button>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 8 }}>
                  Includes rewritten headlines, summary, bullets, ATS score & improvements
                </div>
              </div>
            </Section>

            {/* Top Strengths & Improvements */}
            <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220, background: "#1E293B", border: "1.5px solid #334155", borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>💪 Top Strengths</div>
                {(r.scorer?.topStrengths || []).map((s,i) => <div key={i} style={{ fontSize: 12, color: "#CBD5E1", padding: "5px 0", borderBottom: "1px solid #334155" }}>✅ {s}</div>)}
              </div>
              <div style={{ flex: 1, minWidth: 220, background: "#1E293B", border: "1.5px solid #334155", borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#DB2777", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>🎯 Priority Improvements</div>
                {(r.scorer?.topImprovements || []).map((s,i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #334155" }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg,#2563EB,#DB2777)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                    <span style={{ fontSize: 12, color: "#CBD5E1" }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={reset} style={{ padding: "12px 28px", background: "#334155", color: "#F8FAFC", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              ← Analyze Another Resume
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
