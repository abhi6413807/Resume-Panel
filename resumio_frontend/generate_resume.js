import fs from "fs";
import { Document, Packer, Paragraph, TextRun } from "docx";

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: "Jane Smith",
              bold: true,
              size: 32,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Email: janesmith@example.com",
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Phone: 9876543210",
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Location: Mumbai",
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Summary: I am a Senior Software Developer with experience building highly scalable applications using React and Node.js.",
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Currently at: Tech Solutions",
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Expected CTC: 12 lpa",
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Skills: Technical Skills: React, Node.js, Express, MongoDB, JavaScript, HTML, CSS, SQL, Git",
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Experience: 5 years of experience",
            }),
          ],
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("test_resume.docx", buffer);
  console.log("test_resume.docx generated successfully!");
});
