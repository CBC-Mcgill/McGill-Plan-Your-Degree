// Renders synthetic Minerva unofficial transcripts to PDF with Chromium, plus each expected parse result.
// Run: node lib/transcript/fixtures/generate.mts
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

type Status =
  | "completed"
  | "in-progress"
  | "failed"
  | "withdrawn"
  | "deferred"
  | "transfer"
  | "exemption";

interface Row {
  code: string;
  title: string;
  credits: string;
  status: Status;
  grade?: string;
  remarks?: string;
  earned?: number;
  average?: string;
  registration?: string;
  section?: string;
  // "plain" prints the multi-term mark without Wingdings, as on a machine that lacks the font.
  mark?: "wingdings" | "plain";
  breakBefore?: boolean;
  unrecognized?: boolean;
}

interface CreditRow {
  code: string;
  value: string;
  status: "transfer" | "exemption";
  title?: string;
}

interface TermSpec {
  term: string;
  degree: string;
  load: string;
  programs: string[];
  credits?: { from: string; rows: CreditRow[] }[];
  rows: Row[];
}

interface Fixture {
  name: string;
  identity: { name: string; id: string; code: string };
  holds?: string[][];
  previousEducation?: string;
  creditsRequired?: string;
  terms: TermSpec[];
}

const letterGrades = ["A", "A-", "B+", "B", "B-", "C+", "C", "D", "F"];
const gradePoints: Record<string, number> = {
  A: 4,
  "A-": 3.7,
  "B+": 3.3,
  B: 3,
  "B-": 2.7,
  "C+": 2.3,
  C: 2,
  D: 1,
  F: 0,
  J: 0,
  KF: 0,
};

function row(
  code: string,
  title: string,
  credits: number | string,
  grade: string | undefined,
  status: Status,
  extra: Partial<Row> = {},
): Row {
  return { code, title, credits: String(credits), grade, status, ...extra };
}

function earnedOf(r: Row): number | undefined {
  if (r.grade === undefined) return undefined;
  if (r.earned !== undefined) return r.earned;
  return r.status === "completed" ? Number(r.credits) : 0;
}

const fixtures: Fixture[] = [
  {
    name: "simple-record",
    identity: { name: "Tremblay, Alex", id: "260900001", code: "TREA01020399" },
    creditsRequired: "B Sc Computer Science - 90 credits",
    terms: [
      {
        term: "Fall 2023",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Computer Science"],
        rows: [
          row("COMP 202", "Foundations of Programming", 3, "A", "completed"),
          row("MATH 133", "Linear Algebra and Geometry", 3, "B+", "completed"),
          row("MATH 140", "Calculus 1", 3, "A-", "completed"),
          row("PHYS 101", "Intro Physics - Mechanics", 4, "C+", "completed"),
        ],
      },
      {
        term: "Winter 2024",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Computer Science"],
        rows: [
          row("COMP 250", "Intro to Computer Science", 3, "B", "completed"),
          row("MATH 141", "Calculus 2", 4, "B-", "completed"),
          row("MATH 240", "Discrete Structures", 3, "D", "completed"),
          row("CHEM 110", "General Chemistry 1", 4, "C", "completed"),
        ],
      },
      {
        term: "Summer 2024",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Computer Science"],
        rows: [
          row(
            "ENGL 202",
            "Departmental Survey of Engl Lit",
            3,
            "A",
            "completed",
          ),
        ],
      },
    ],
  },
  {
    name: "registered-courses",
    identity: { name: "Nguyen, Bao", id: "260900002", code: "NGUB02030499" },
    creditsRequired: "B Sc Software Engineering - 90 credits",
    terms: [
      {
        term: "Fall 2025",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Software Engineering"],
        rows: [
          row("COMP 206", "Intro to Software Systems", 3, "A-", "completed"),
          row("COMP 250", "Intro to Computer Science", 3, "B+", "completed"),
        ],
      },
      {
        term: "Winter 2026",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Software Engineering"],
        rows: [
          row(
            "COMP 251",
            "Algorithms and Data Structures",
            3,
            undefined,
            "in-progress",
            { registration: "RW" },
          ),
          row(
            "COMP 273",
            "Intro to Computer Systems",
            3,
            undefined,
            "in-progress",
            { registration: "RL" },
          ),
          row("MATH 240", "Discrete Structures", 3, undefined, "in-progress", {
            registration: "RR",
          }),
          row(
            "ECSE 223",
            "Model-Based Programming",
            3,
            undefined,
            "withdrawn",
            { registration: "WC" },
          ),
        ],
      },
      {
        term: "Fall 2026",
        degree: "Bachelor of Science",
        load: "Year 2",
        programs: ["Major Software Engineering"],
        rows: [
          row(
            "COMP 302",
            "Programming Lang & Paradigms",
            3,
            undefined,
            "in-progress",
            { registration: "RW" },
          ),
          row("COMP 303", "Software Design", 3, undefined, "in-progress", {
            registration: "RW",
          }),
        ],
      },
    ],
  },
  {
    name: "pass-fail",
    identity: { name: "Roy, Camille", id: "260900003", code: "ROYC03040599" },
    creditsRequired: "B Sc Computer Science - 90 credits",
    terms: [
      {
        term: "Fall 2024",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Computer Science"],
        rows: [
          row("COMP 202", "Foundations of Programming", 3, "B+", "completed"),
          row("FACC 250", "Resp. of the Prof. Engineer", 0, "P", "completed", {
            average: "",
          }),
          row("FACC 100", "Intro to the Eng. Profession", 1, "F", "failed"),
          row("PSYC 100", "Introduction to Psychology", 3, "S", "completed", {
            average: "",
          }),
          row("ARTH 205", "Intro to Modern Art", 3, "U", "failed", {
            average: "",
          }),
        ],
      },
    ],
  },
  {
    name: "withdrawals",
    identity: { name: "Lee, Dana", id: "260900004", code: "LEED04050699" },
    creditsRequired: "B Sc Computer Science - 90 credits",
    terms: [
      {
        term: "Fall 2024",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Computer Science"],
        rows: [
          row("COMP 202", "Foundations of Programming", 3, "A", "completed"),
          row("MATH 133", "Linear Algebra and Geometry", 3, "W", "withdrawn", {
            average: "",
          }),
          row("MATH 140", "Calculus 1", 3, "WF", "withdrawn", { average: "" }),
        ],
      },
      {
        term: "Winter 2025",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Computer Science"],
        rows: [
          row("COMP 250", "Intro to Computer Science", 3, "WL", "withdrawn", {
            average: "",
          }),
          row("MATH 141", "Calculus 2", 4, "B", "completed"),
        ],
      },
    ],
  },
  {
    name: "failures",
    identity: { name: "Martin, Eli", id: "260900005", code: "MARE05060799" },
    creditsRequired: "B Eng Software - 133 credits",
    terms: [
      {
        term: "Fall 2023",
        degree: "Bachelor of Engineering",
        load: "Year 1",
        programs: ["Software Engineering"],
        rows: [
          row("MATH 262", "Intermediate Calculus", 3, "F", "failed"),
          row("ECSE 200", "Electric Circuits 1", 3, "J", "failed", {
            average: "C+",
          }),
          row("COMP 202", "Foundations of Programming", 3, "KF", "failed", {
            average: "",
          }),
          row("ECSE 205", "Prob and Stats for Engineers", 3, "B-", "completed"),
        ],
      },
      {
        term: "Winter 2024",
        degree: "Bachelor of Engineering",
        load: "Year 1",
        programs: ["Software Engineering"],
        rows: [
          row("MATH 262", "Intermediate Calculus", 3, "C", "completed"),
          row("ECSE 200", "Electric Circuits 1", 3, "B", "completed"),
        ],
      },
    ],
  },
  {
    name: "deferred-grades",
    identity: { name: "Kaur, Farah", id: "260900006", code: "KAUF06070899" },
    creditsRequired: "B Sc Computer Science - 90 credits",
    terms: [
      {
        term: "Winter 2025",
        degree: "Bachelor of Science",
        load: "Year 2",
        programs: ["Major Computer Science"],
        rows: [
          row(
            "COMP 251",
            "Algorithms and Data Structures",
            3,
            "L",
            "deferred",
            { average: "" },
          ),
          row("COMP 273", "Intro to Computer Systems", 3, "K", "deferred", {
            average: "",
          }),
          row("MATH 223", "Linear Algebra", 3, "L*", "deferred", {
            average: "",
          }),
          row("MATH 235", "Algebra 1", 3, "KE", "deferred", { average: "" }),
          row("MATH 248", "Honours Vector Calculus", 3, "NR", "in-progress", {
            average: "",
          }),
          row("COMP 330", "Theory of Computation", 3, "A-", "completed"),
        ],
      },
    ],
  },
  {
    name: "remarks-and-unknown-lines",
    identity: { name: "Silva, Gabriel", id: "260900007", code: "SILG07080999" },
    creditsRequired: "B Sc Computer Science - 90 credits",
    terms: [
      {
        term: "Fall 2024",
        degree: "Bachelor of Science",
        load: "Year 2",
        programs: ["Major Computer Science"],
        rows: [
          row(
            "COMP 251",
            "Algorithms and Data Structures",
            3,
            "A",
            "completed",
            { remarks: "I" },
          ),
          row("MATH 222", "Calculus 3", 3, "B", "completed", {
            remarks: "E",
            earned: 0,
          }),
          row("MATH 223", "Linear Algebra", 3, "C+", "completed", {
            remarks: "A",
            earned: 0,
          }),
          row(
            "BIOL 111",
            "Principles: Organismal Biology",
            3,
            "B+",
            "completed",
            { remarks: "EXC", earned: 0 },
          ),
          row(
            "COMP 302",
            "Programming Lang & Paradigms",
            3,
            "ZZ",
            "completed",
            { unrecognized: true },
          ),
          row("COMP 303", "Software Design", "TBA", "A", "completed", {
            unrecognized: true,
          }),
        ],
      },
    ],
  },
  {
    name: "transfer-credits",
    identity: { name: "Haddad, Hana", id: "260900008", code: "HADH08091099" },
    previousEducation: "Quebec CEGEP/IB",
    creditsRequired: "B Sc Computer Science - 90 credits",
    terms: [
      {
        term: "Fall 2024",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Computer Science"],
        credits: [
          {
            from: "Dawson College - 24 credits",
            rows: [
              { code: "COMP 202", value: "EXC", status: "exemption" },
              { code: "MATH 133", value: "EXC", status: "exemption" },
            ],
          },
          {
            from: "Advanced Placement - 7 credits",
            rows: [
              { code: "MATH 140", value: "3", status: "transfer" },
              { code: "CHEM 110", value: "4", status: "transfer" },
            ],
          },
          {
            from: "International Baccalaureate - 6 credits",
            rows: [
              { code: "PSYC 100", value: "3", status: "transfer" },
              { code: "ECON 2XX", value: "3", status: "transfer" },
            ],
          },
        ],
        rows: [
          row("COMP 250", "Intro to Computer Science", 3, "A-", "completed"),
          row("MATH 141", "Calculus 2", 4, "B+", "completed"),
        ],
      },
      {
        term: "Winter 2025",
        degree: "Bachelor of Science",
        load: "Year 1",
        programs: ["Major Computer Science"],
        credits: [
          {
            from: "Concordia University - 6 credits",
            rows: [
              { code: "TRNS XXX", value: "6", status: "transfer" },
              { code: "PHYS 131", value: "EXC", status: "exemption" },
            ],
          },
        ],
        rows: [
          row(
            "COMP 251",
            "Algorithms and Data Structures",
            3,
            "B",
            "completed",
          ),
        ],
      },
    ],
  },
  {
    name: "multi-term-courses",
    identity: { name: "Okafor, Ines", id: "260900009", code: "OKAI09101199" },
    creditsRequired: "B Eng Computer - 133 credits",
    terms: [
      {
        term: "Fall 2025",
        degree: "Bachelor of Engineering",
        load: "Year 3",
        programs: ["Computer Engineering"],
        rows: [
          row("ECSE 458D1", "Capstone Design Project", 3, "A", "completed", {
            mark: "wingdings",
          }),
          row("ECSE 324", "Computer Organization", 4, "B+", "completed"),
          row("MATH 470J1", "Honours Research Project", 1, "A-", "completed", {
            mark: "plain",
          }),
        ],
      },
      {
        term: "Winter 2026",
        degree: "Bachelor of Engineering",
        load: "Year 3",
        programs: ["Computer Engineering"],
        rows: [
          row("ECSE 458D2", "Capstone Design Project", 3, "A", "completed", {
            mark: "wingdings",
          }),
          row("MATH 470J2", "Honours Research Project", 1, "A-", "completed", {
            mark: "plain",
          }),
          row(
            "FACC 400N1",
            "Engineering Professional Practice",
            1,
            undefined,
            "in-progress",
            { registration: "RW", mark: "wingdings" },
          ),
        ],
      },
      {
        term: "Summer 2026",
        degree: "Bachelor of Engineering",
        load: "Year 3",
        programs: ["Computer Engineering"],
        rows: [
          row(
            "MATH 470J3",
            "Honours Research Project",
            1,
            undefined,
            "in-progress",
            { registration: "RW", mark: "wingdings" },
          ),
        ],
      },
      {
        term: "Fall 2026",
        degree: "Bachelor of Engineering",
        load: "Year 4",
        programs: ["Computer Engineering"],
        rows: [
          row(
            "FACC 400N2",
            "Engineering Professional Practice",
            1,
            undefined,
            "in-progress",
            { registration: "RW", mark: "wingdings" },
          ),
        ],
      },
    ],
  },
  {
    name: "long-record",
    identity: { name: "Fortin, Jules", id: "260900010", code: "FORJ10111299" },
    holds: [
      [
        "Academic Advising Hold",
        "Aug 1, 2023",
        "Dec 31, 2099",
        "",
        "replace MATH 133 3cr exemption",
        "",
        "Registration",
      ],
    ],
    previousEducation: "Quebec CEGEP/IB",
    creditsRequired: "B Eng Software - 133 credits",
    terms: longRecordTerms(),
  },
];

function longRecordTerms(): TermSpec[] {
  const subjects = ["COMP", "ECSE", "MATH", "FACC", "MGCR"];
  const grades = ["A", "A-", "B+", "B", "B-", "C+"];
  const terms: TermSpec[] = [];
  let n = 0;
  for (const [i, term] of [
    "Fall 2022",
    "Winter 2023",
    "Fall 2023",
    "Winter 2024",
    "Fall 2024",
    "Winter 2025",
    "Fall 2025",
    "Winter 2026",
  ].entries()) {
    const rows: Row[] = [];
    for (let k = 0; k < 6; k++) {
      n++;
      rows.push(
        row(
          `${subjects[(n + k) % subjects.length]} ${200 + n * 3}`,
          `Synthetic Course ${n}`,
          3,
          grades[n % grades.length],
          "completed",
          {
            // Forces a page break inside the Fall 2024 course rows.
            breakBefore: term === "Fall 2024" && k === 3,
          },
        ),
      );
    }
    terms.push({
      term,
      degree: "Bachelor of Engineering",
      load: `Year ${Math.floor(i / 2) + 1}`,
      programs:
        i < 4
          ? ["Computer Engineering"]
          : ["Software Engineering", "Minor Management"],
      rows,
    });
  }
  terms.push({
    term: "Fall 2026",
    degree: "Bachelor of Engineering",
    load: "Year 4",
    programs: ["Software Engineering", "Minor Management"],
    rows: [
      row(
        "ECSE 428",
        "Software Engineering Practice",
        3,
        undefined,
        "in-progress",
        { registration: "RW" },
      ),
    ],
  });
  return terms;
}

const escapeHtml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function mark(r: Row): string {
  if (!r.mark) return "";
  return r.mark === "plain" ? "²" : '<span class="wing">²</span>';
}

function rawText(r: Row): string {
  return [
    r.registration,
    r.code,
    r.section ?? "001",
    r.title,
    r.credits,
    r.grade,
    r.remarks,
    earnedOf(r)?.toString(),
    averageOf(r),
  ]
    .filter((c) => c !== undefined && c !== "")
    .join(" ");
}

function averageOf(r: Row): string | undefined {
  if (r.grade === undefined) return undefined;
  if (r.average !== undefined) return r.average;
  return letterGrades.includes(r.grade) ? "B" : "";
}

function courseRow(r: Row): string {
  const cells = [
    r.registration ?? "",
    r.code,
    mark(r),
    r.section ?? "001",
    escapeHtml(r.title),
    r.credits,
    r.grade ?? "",
    r.remarks ?? "",
    earnedOf(r)?.toString() ?? "",
    averageOf(r) ?? "",
  ];
  const style = r.breakBefore ? ' style="break-before: page"' : "";
  return `<tr class="course"${style}>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
}

const money = (n: number) => n.toFixed(2);

function render(f: Fixture): string {
  let transfer = 0;
  const cum = { att: 0, earned: 0, gpa: 0, points: 0 };
  const blocks = f.terms.map((t) => {
    const lines = [
      `<tr><td colspan="10" class="term">${t.term}</td></tr>`,
      `<tr><td colspan="10" class="gap">${t.degree}</td></tr>`,
      `<tr><td colspan="10"><span class="load">Full-time</span>${t.load}</td></tr>`,
      ...t.programs.map((p) => `<tr><td colspan="10">${p}</td></tr>`),
    ];
    if (t.credits) {
      lines.push(
        '<tr><td colspan="10" class="gap">Credits/Exemptions</td></tr>',
      );
      for (const group of t.credits) {
        lines.push(
          `<tr><td colspan="10" class="gap">From: ${group.from}</td></tr>`,
        );
        transfer += Number(/(\d+) credits/.exec(group.from)?.[1] ?? 0);
        for (const c of group.rows) {
          const [subject, number] = c.code.split(" ");
          lines.push(
            `<tr class="credit"><td>${subject}</td><td>${number}</td><td></td><td colspan="2">${c.value}</td><td colspan="5"></td></tr>`,
          );
        }
      }
    }
    lines.push(...t.rows.map(courseRow));
    const graded = t.rows.filter(
      (r) => r.grade !== undefined && !r.unrecognized,
    );
    if (graded.length > 0) {
      const term = { att: 0, earned: 0, gpa: 0, points: 0 };
      for (const r of graded) {
        const points = gradePoints[r.grade ?? ""];
        if (points !== undefined) {
          term.att += Number(r.credits);
          term.gpa += Number(r.credits);
          term.points += points * Number(r.credits);
        }
        term.earned += earnedOf(r) ?? 0;
      }
      for (const k of ["att", "earned", "gpa", "points"] as const)
        cum[k] += term[k];
      const gpa = (x: typeof term) =>
        x.gpa ? (x.points / x.gpa).toFixed(2) : "0.00";
      lines.push(`<tr><td colspan="10"><table class="totals">
<tr><td></td><td></td><td colspan="2">Advanced Standing<br>&amp; Transfer Credits:</td><td></td><td>Att Cr</td><td>Earned Cr</td><td>GPA Cr</td><td>Points</td></tr>
<tr><td>TERM<br>GPA:</td><td>${gpa(term)}</td><td></td><td>${money(transfer)}</td><td>TERM TOTALS:</td><td>${money(term.att)}</td><td>${money(term.earned)}</td><td>${money(term.gpa)}</td><td>${money(term.points)}</td></tr>
<tr><td>CUM GPA:</td><td>${gpa(cum)}</td><td>TOTAL CREDITS:</td><td>${money(transfer + cum.earned)}</td><td>CUM TOTALS:</td><td>${money(cum.att)}</td><td>${money(cum.earned)}</td><td>${money(cum.gpa)}</td><td>${money(cum.points)}</td></tr>
</table></td></tr>`);
      lines.push(
        '<tr><td colspan="10" class="gap"><span class="load">Standing:</span>Satisfactory</td></tr>',
      );
    }
    return lines.join("\n");
  });

  const holds = f.holds
    ? `<p class="label">Student Holds</p><table class="holds"><tr>${["Hold Type", "From Date", "To Date", "Amount", "Reason", "Originator", "Holds"].map((h) => `<th>${h}</th>`).join("")}</tr>
${f.holds.map((h) => `<tr>${h.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("\n")}</table>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>UNOFFICIAL Transcript for ID</title><style>
body { font: 8.84pt Arial, sans-serif; margin: 0 0 0 11pt; color: #000; }
h1 { font-size: 17.7pt; font-weight: normal; margin: 26pt 0 14pt -4pt; }
.info { font-size: 8.84pt; margin: 0 0 22pt 13pt; line-height: 11pt; }
.wing { font-family: Wingdings; }
.identity td { padding: 1pt 0; } .identity td:first-child { width: 175pt; font-weight: bold; }
.label { font-weight: bold; margin: 12pt 0 2pt; }
.holds { border-collapse: collapse; margin-bottom: 12pt; } .holds th { text-align: left; padding-right: 20pt; } .holds td { padding-right: 20pt; }
.main { border-collapse: collapse; table-layout: fixed; width: 525pt; }
.main td { padding: 0; vertical-align: top; white-space: nowrap; overflow: hidden; }
.main th { text-align: left; vertical-align: top; }
.course td, .credit td { padding: 2.6pt 0; }
.term { font-weight: bold; padding-top: 16pt !important; }
.gap { padding-top: 14pt !important; }
.load { display: inline-block; width: 41pt; }
.totals { width: 100%; margin-top: 14pt; border-collapse: collapse; } .totals td { padding: 1pt 0; white-space: normal; }
.footer { font-size: 8.84pt; margin-top: 18pt; }
.notice { font-size: 8.84pt; margin: 18pt 0; }
</style></head><body>
<h1>UNOFFICIAL Transcript</h1>
<div class="info"><span class="wing">²</span> A diamond appears beside a course number to indicate a multi-term course.<br><br>
* An asterisk appears next to the credit value of courses not counted in the total credits earned.<br><br>
Remarks column:<br>I - Course is <b>included</b> in credits and <b>included</b> in the GPA.<br>
E - Course is <b>excluded</b> from credits and <b>excluded</b> from the GPA.<br>
A - Course is <b>excluded</b> from credits and <b>included</b> in the GPA.<br><br>
Please click <a href="#">help</a> for more transcript information or <a href="#">registration holds</a> for more information on holds.</div>
<table class="identity">
<tr><td>Student Name with Preferred First Name:</td><td>${f.identity.name}</td></tr>
<tr><td>McGill ID:</td><td>${f.identity.id}</td></tr>
<tr><td>Permanent Code:</td><td>${f.identity.code}</td></tr>
</table>
${holds}
<table class="main">
<colgroup><col style="width:42pt"><col style="width:55pt"><col style="width:25pt"><col style="width:21pt"><col style="width:164pt"><col style="width:49pt"><col style="width:39pt"><col style="width:45pt"><col style="width:40pt"><col style="width:45pt"></colgroup>
<tr><th>Subject</th><th colspan="2">Number</th><th colspan="2" style="text-align:center">Title</th><th>Cr. / C.E.U.</th><th>Grade</th><th>Remarks</th><th>Earned</th><th>Class<br>Avg.</th></tr>
${f.previousEducation ? `<tr><td colspan="10" class="gap" style="font-weight:bold">PREVIOUS EDUCATION</td></tr><tr><td colspan="10">${f.previousEducation}</td></tr>` : ""}
${f.creditsRequired ? `<tr><td colspan="10" class="gap">Credits Required for ${f.creditsRequired}</td></tr>` : ""}
${blocks.join("\n")}
</table>
<div class="footer">RELEASE: 1.20<br>FORM NAME: SWFTRAN</div>
<div class="notice"><b>NOTICE: Are you receiving "Page not working" or "Page can't be displayed" errors?</b><br>
If you are using Internet Explorer or Microsoft Edge, try switching to Chrome or Firefox.</div>
<div class="footer">© 2026 Ellucian Company L.P. and its affiliates.</div>
</body></html>`;
}

function expected(f: Fixture) {
  const courses = [];
  const unrecognized = [];
  let block: TermSpec | undefined;
  for (const t of f.terms) {
    const [season, year] = t.term.split(" ");
    const term = { season, year: Number(year) };
    for (const group of t.credits ?? []) {
      for (const c of group.rows) {
        const credits = c.status === "transfer" ? Number(c.value) : null;
        courses.push({
          code: c.code,
          title: c.title ?? null,
          term,
          credits,
          grade: null,
          remarks: null,
          earnedCredits: credits ?? 0,
          multiTerm: /[A-Z]\d$/.test(c.code),
          status: c.status,
        });
      }
    }
    for (const r of t.rows) {
      if (r.unrecognized) {
        unrecognized.push(rawText(r));
        continue;
      }
      courses.push({
        code: r.code,
        title: r.title,
        term,
        credits: Number(r.credits),
        grade: r.grade ?? null,
        remarks: r.remarks ?? null,
        earnedCredits: earnedOf(r) ?? null,
        multiTerm: r.mark !== undefined || /[A-Z]\d$/.test(r.code),
        status: r.status,
      });
    }
    block = t;
  }
  return {
    ok: true,
    transcript: {
      degree: block?.degree ?? null,
      programs: block?.programs.filter((p) => !p.startsWith("Minor")) ?? [],
      minors: block?.programs.filter((p) => p.startsWith("Minor")) ?? [],
      creditsRequired:
        Number(/(\d+) credits/.exec(f.creditsRequired ?? "")?.[1]) || null,
      courses,
      unrecognized,
    },
  };
}

const notTranscript = `<!doctype html><html><head><meta charset="utf-8"><title>COMP 250 Course Outline</title></head>
<body style="font: 11pt Arial">
<h1>COMP 250 Intro to Computer Science</h1><p>Fall 2025</p>
<table><tr><td>COMP 250</td><td>001</td><td>Intro to Computer Science</td><td>3</td></tr></table>
<p>Prerequisite: COMP 202. Bring your UNOFFICIAL Transcript to advising if you need a prerequisite waiver.</p>
</body></html>`;

const tooManyPages = `<!doctype html><html><body style="font: 11pt Arial">
${Array.from({ length: 21 }, (_, i) => `<p style="break-after: page">Page ${i + 1}</p>`).join("")}
</body></html>`;

const dir = import.meta.dirname;
const browser = await chromium.launch();
const page = await browser.newPage();
async function print(
  name: string,
  html: string,
  title = "UNOFFICIAL Transcript for ID",
  url = "https://horizon.mcgill.ca/pban1/bzsktran.P_Display_Form?user_type=S&amp;tran_type=V",
) {
  await page.setContent(html, { waitUntil: "load" });
  await writeFile(
    join(dir, `${name}.pdf`),
    await page.pdf({
      format: "Letter",
      displayHeaderFooter: true,
      margin: {
        top: "0.45in",
        bottom: "0.45in",
        left: "0.4in",
        right: "0.4in",
      },
      headerTemplate: `<div style="font: 8.84pt Arial; width: 100%; margin: 0 24pt; display: flex"><span>1/15/26, 10:30 AM</span><span style="flex: 1; text-align: center">${title}</span></div>`,
      footerTemplate: `<div style="font: 8.84pt Arial; width: 100%; margin: 0 24pt; display: flex"><span style="flex: 1">${url}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
    }),
  );
}
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

for (const f of fixtures) {
  await print(f.name, render(f));
  const mustNotContain = [
    f.identity.name,
    f.identity.id,
    f.identity.code,
    ...(f.holds ?? []).flat().filter(Boolean),
  ];
  await writeFile(
    join(dir, `${f.name}.json`),
    json({ result: expected(f), mustNotContain }),
  );
}
// Only the body mentions the title, so a single marker must not be enough.
await print(
  "not-a-transcript",
  notTranscript,
  "COMP 250 Course Outline",
  "https://example.com/outline/comp250",
);
await writeFile(
  join(dir, "not-a-transcript.json"),
  json({ result: { ok: false, error: "not-transcript" }, mustNotContain: [] }),
);
await print("too-many-pages", tooManyPages);
await writeFile(
  join(dir, "too-many-pages.json"),
  json({ result: { ok: false, error: "too-many-pages" }, mustNotContain: [] }),
);
await browser.close();
