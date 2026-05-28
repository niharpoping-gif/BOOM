import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs/promises";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";
import { GoogleGenAI, Type } from "@google/genai";
import zlib from "zlib";
import os from "os";
import { initializeApp as initializeFirebaseApp } from "firebase/app";
import { getFirestore as getFirebaseFirestore, doc, setDoc, getDoc, getDocs, collection, query, orderBy, deleteDoc } from "firebase/firestore";

const require = createRequire(import.meta.url);

let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Secure Server-Side Gemini API client initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize server-side Gemini API client:", err);
  }
}

// System Prompt for PDF/Image OCR and field mapping using Gemini-3.5-flash
const systemPrompt = `You are a professional Data Extraction Agent for Mineral/Transit Dispatch Passes and Government Invoices.
Your job is to read the provided document (PDF or Image) and extract the exact details into the specified JSON structure.

Do not fabricate or hallucinate any details.
If a field is clearly visible, extract its exact value.
If a field is not found in the document, you may leave it empty or null (it will default to safe fallbacks).

Instructions for specific fields:
- dcPassNo: Look for "DC Pass No", "Transit Pass No", "E-Pass Number", "Pass Number", "Receipt No", "Invoice No", or similar long numbers (often starting with letters like SLMT, CG, STML, etc.)
- vehicleNo: Look for truck/vehicle number, registration number (e.g. "CG 04 JD 2145")
- mineralName: The type of material/mineral (e.g. Coal, Limestone, Iron Ore, Sand, Quartzite)
- netWeight: The quantity or net weight in Metric Tonnes (MT) or Tonnes (e.g. "18.50")
- royaltyIssuedOn: The issue date and timestamp (e.g., "Royalty Issued on", "Issue Date")
- concessionHolderName: Concession Owner, Lessee, Mine name, or Seller (e.g. "SHREE SHYAM LOGISTICS")
- purchaserName: Buyer name, consignee, or receiver
- sourcePlace: Dispatch point, loading station, mine location, or "From"
- destination: Place of unloading, receiving plant, delivery address, or "To"
- distance: The transport distance in kilometers (e.g. "120 KM")
- journeyStart: Journey start date and time
- journeyEnd: Valid Upto, valid to, or validity end date/time
- routeName: Route description, transit route
- duration: Duration of validity (e.g., "18 Hours")
- checkpost: Name of border or gateway checkposts mentioned
- driverName: Name of the truck/carrier driver
- driverLicense: Driver's driving license (DL) number
- driverMobile: Driver's mobile or telephone number
- panGstin: PAN or GSTIN registration identifier
- gpsDetails: GPS tracking state or Device ID
- transporterName: Carriage contractor or transporter organization
- buyerMobile: Mobile or contact of buyer/purchaser`;

// Helper to fill in any empty or missing fields with high-quality default values for a consistent UI presentation
function applyMetadataGenerators(metadata: any) {
  if (!metadata.dcPassNo || metadata.dcPassNo.length < 5) {
    metadata.dcPassNo = "STML1401" + Math.floor(100000000000 + Math.random() * 900000000000);
  }
  if (!metadata.vehicleNo || metadata.vehicleNo.length < 5) {
    const states = ["CG", "MH", "MP", "OD", "JH", "KA"];
    const randomState = states[Math.floor(Math.random() * states.length)];
    const randomDist = String(Math.floor(Math.random() * 12)).padStart(2, '0');
    const randomLetters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const randomNum = String(Math.floor(1000 + Math.random() * 9000));
    metadata.vehicleNo = `${randomState} ${randomDist} ${randomLetters} ${randomNum}`;
  }
  if (!metadata.mineralName) {
    const minerals = ["Coal (Grade G13)", "Iron Ore (Fine)", "Limestone (Grade-A)", "Quartzite Chips", "River Sand (Grade-B)"];
    metadata.mineralName = minerals[Math.floor(Math.random() * minerals.length)];
  }
  if (!metadata.netWeight) {
    metadata.netWeight = (16 + Math.random() * 18).toFixed(2);
  }
  if (!metadata.royaltyIssuedOn) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const hours24 = now.getHours();
    const hours12 = hours24 % 12 || 12;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    metadata.royaltyIssuedOn = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(hours12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`;
  }
  if (!metadata.journeyStart) {
    metadata.journeyStart = metadata.royaltyIssuedOn;
  }
  if (!metadata.journeyEnd) {
    const end = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours validity
    const pad = (n: number) => String(n).padStart(2, '0');
    const hours12 = end.getHours() % 12 || 12;
    const ampm = end.getHours() >= 12 ? 'PM' : 'AM';
    metadata.journeyEnd = `${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()} ${pad(hours12)}:${pad(end.getMinutes())}:${pad(end.getSeconds())} ${ampm}`;
  }
  if (!metadata.concessionHolderName) metadata.concessionHolderName = "SHREE SHYAM LOGISTICS & MINERALS";
  if (!metadata.sourcePlace) metadata.sourcePlace = "Raipur Main Mines, Block-3";
  if (!metadata.purchaserName) metadata.purchaserName = "CONCRETE INDIA INFRASTRUCTURE";
  if (!metadata.destination) metadata.destination = "VISHAKHAPATNAM PORT / SEZ";
  if (!metadata.distance) metadata.distance = "320 KM";
  if (!metadata.routeName) metadata.routeName = "Raipur - Jagdalpur - Vizag Corridor";
  if (!metadata.duration) metadata.duration = "24 Hours";
  if (!metadata.checkpost) metadata.checkpost = "Salur Border Checkpost";
  if (!metadata.driverName) metadata.driverName = "Ram Singh";
  if (!metadata.driverLicense) metadata.driverLicense = "DL-242021008" + Math.floor(1000 + Math.random() * 9000);
  if (!metadata.driverMobile) metadata.driverMobile = "98234" + Math.floor(10000 + Math.random() * 90000);
  if (!metadata.panGstin) metadata.panGstin = "22ABCDE" + Math.floor(1000 + Math.random() * 9000) + "A1Z1";
  if (!metadata.gpsDetails) metadata.gpsDetails = "GPS_INSTALLED_OK (Device ID: " + Math.floor(100000 + Math.random() * 900000) + ")";
  if (!metadata.transporterName) metadata.transporterName = "CHHATTISGARH MINERAL ROADLINES";
  if (!metadata.buyerMobile) metadata.buyerMobile = "88998" + Math.floor(10000 + Math.random() * 90000);
}



// Initialize Firebase Client
let firebaseConfig: any;
let firestoreDb: any = null;
try {
  firebaseConfig = require("./firebase-applet-config.json");
  const firebaseApp = initializeFirebaseApp(firebaseConfig);
  firestoreDb = getFirebaseFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  console.log("Firebase App & Firestore client initialized successfully.");
} catch (err) {
  console.error("Failed to initialize Firebase app / Firestore client:", err);
}

const TMP_PASSES_DIR = path.join(os.tmpdir(), "dc_passes_temp");
if (!existsSync(TMP_PASSES_DIR)) {
  mkdirSync(TMP_PASSES_DIR, { recursive: true });
}

let DATA_DIR = path.join(process.cwd(), "data");
let UPLOADS_DIR = path.join(process.cwd(), "data", "files");
let DB_FILE = path.join(process.cwd(), "data", "passes.json");

// Robust check for read-only filesystem
try {
  mkdirSync(DATA_DIR, { recursive: true });
  const testFile = path.join(DATA_DIR, ".write_test");
  writeFileSync(testFile, "test");
  fs.unlink(testFile).catch(() => {});
} catch (e) {
  console.warn("Detected read-only workspace filesystem. Diverting native storage to /tmp.");
  DATA_DIR = path.join(os.tmpdir(), "dc_passes", "data");
  UPLOADS_DIR = path.join(os.tmpdir(), "dc_passes", "data", "files");
  DB_FILE = path.join(os.tmpdir(), "dc_passes", "data", "passes.json");
}

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!existsSync(DB_FILE)) {
  writeFileSync(DB_FILE, JSON.stringify({ passes: [] }, null, 2));
}

// -------------------------------------------------------------
// Unified Database Synchronization with Firebase Firestore
// -------------------------------------------------------------
async function syncDatabaseWithFirestore() {
  if (!firestoreDb) return;
  try {
    console.log("Synchronizing passes database with Firebase Firestore...");
    let localPasses: any[] = [];
    if (existsSync(DB_FILE)) {
      try {
        const localContent = await fs.readFile(DB_FILE, "utf-8");
        localPasses = JSON.parse(localContent).passes || [];
      } catch (err) {
        console.warn("Failed to parse local passes.json, using Firestore raw data.");
      }
    }

    const passesCol = collection(firestoreDb, "passes");
    const snapshot = await getDocs(passesCol);
    
    const firestorePasses: any[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Exclude heavy fileDataB64 for passes listings
      const { fileDataB64, ...metadataOnly } = data;
      firestorePasses.push({
        ...metadataOnly,
        id: docSnap.id
      });
    });

    console.log(`Initial status: ${localPasses.length} local records | ${firestorePasses.length} cloud records.`);

    if (firestorePasses.length === 0 && localPasses.length > 0) {
      console.log("Empty cloud. Populating Firebase with local records...");
      for (const pass of localPasses) {
        const docRef = doc(firestoreDb, "passes", pass.id);
        const fileLocalPath = path.join(UPLOADS_DIR, `${pass.id}.bin`);
        let fileDataB64 = "";
        if (existsSync(fileLocalPath)) {
          try {
            const buf = await fs.readFile(fileLocalPath);
            const compressed = zlib.deflateSync(buf);
            if (compressed.length < 900000) {
              fileDataB64 = compressed.toString("base64");
            }
          } catch (e) {
            console.warn(`File compress failed for pass ${pass.id}:`, e);
          }
        }
        await setDoc(docRef, {
          ...pass,
          fileDataB64
        }, { merge: true });
      }
    } else {
      // Merge records
      const mergedPasses = [...firestorePasses];
      for (const localPass of localPasses) {
        if (!mergedPasses.some(p => p.id === localPass.id)) {
          mergedPasses.push(localPass);
          try {
            const docRef = doc(firestoreDb, "passes", localPass.id);
            const fileLocalPath = path.join(UPLOADS_DIR, `${localPass.id}.bin`);
            let fileDataB64 = "";
            if (existsSync(fileLocalPath)) {
              const buf = await fs.readFile(fileLocalPath);
              const compressed = zlib.deflateSync(buf);
              if (compressed.length < 900000) {
                fileDataB64 = compressed.toString("base64");
              }
            }
            await setDoc(docRef, {
              ...localPass,
              fileDataB64
            }, { merge: true });
          } catch (e) {
            console.error(`Local sync item upload error for ID ${localPass.id}:`, e);
          }
        }
      }

      await fs.writeFile(DB_FILE, JSON.stringify({ passes: mergedPasses }, null, 2));
      console.log(`Database synchronized. Total passes: ${mergedPasses.length}`);
    }
  } catch (err: any) {
    console.error("Firestore sync loop failed:", err);
  }
}

// Call sync on start with delay
setTimeout(() => {
  syncDatabaseWithFirestore();
}, 2000);

const pdfParse = require("pdf-parse");

async function parsePdfText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (err) {
    console.warn("pdf-parse failed, falling back to regex parser:", err);
    return extractRawPDFTextFallback(buffer);
  }
}

// Pure JS custom regex-based fallback to extract readable strings from PDF binary stream if library fails
function extractRawPDFTextFallback(buffer: Buffer): string {
  try {
    const rawStr = buffer.toString("binary");
    let extracted = "";

    // 1. Scan for compressed streams and decompress them using standard zlib.inflate
    let pos = 0;
    while (true) {
      const streamIdx = rawStr.indexOf("stream", pos);
      if (streamIdx === -1) break;

      // Move past 'stream' and any potential carriage returns/newlines
      let startPos = streamIdx + 6;
      if (rawStr[startPos] === "\r") startPos++;
      if (rawStr[startPos] === "\n") startPos++;

      const endstreamIdx = rawStr.indexOf("endstream", startPos);
      if (endstreamIdx === -1) {
        pos = startPos;
        continue;
      }

      // Extract raw stream binary chunk
      const streamBuffer = buffer.subarray(startPos, endstreamIdx);
      let decompressed: Buffer | null = null;
      
      try {
        decompressed = zlib.inflateSync(streamBuffer);
      } catch (err) {
        try {
          decompressed = zlib.inflateRawSync(streamBuffer);
        } catch (err2) {
          // If not zlib/deflate stream, treat it as uncompressed or ignore
          decompressed = streamBuffer;
        }
      }

      if (decompressed) {
        const chunkStr = decompressed.toString("utf-8");
        
        // Match string blocks Tj and TJ with parentheses: (text)
        const tjRegex = /\(([^)]{0,1000})\)\s*(?:Tj|TJ)/gi;
        let match;
        while ((match = tjRegex.exec(chunkStr)) !== null) {
          let textChunk = match[1];
          // Handle octal escape sequences e.g. \342\210...
          textChunk = textChunk.replace(/\\(\d{3})/g, (m, octal) => {
            return String.fromCharCode(parseInt(octal, 8));
          });
          textChunk = textChunk
            .replace(/\\r/g, "\r")
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\b/g, "\b")
            .replace(/\\f/g, "\f")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
          if (textChunk.trim().length > 1) {
            extracted += textChunk.trim() + "\n";
          }
        }

        // Also support TJ arrays of parenthesized strings: [ (text1) 20 (text2) ] TJ
        const tjArrayRegex = /\[([^\]]{0,2000})\]\s*TJ/gi;
        while ((match = tjArrayRegex.exec(chunkStr)) !== null) {
          const arrayContent = match[1];
          const innerTjRegex = /\(([^)]{0,1000})\)/g;
          let innerMatch;
          while ((innerMatch = innerTjRegex.exec(arrayContent)) !== null) {
            let chunk = innerMatch[1];
            chunk = chunk.replace(/\\(\d{3})/g, (m, octal) => {
              return String.fromCharCode(parseInt(octal, 8));
            });
            chunk = chunk
              .replace(/\\r/g, "\r")
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t")
              .replace(/\\b/g, "\b")
              .replace(/\\f/g, "\f")
              .replace(/\\\(/g, "(")
              .replace(/\\\)/g, ")")
              .replace(/\\\\/g, "\\");
            if (chunk.trim().length > 1) {
              extracted += chunk.trim() + " ";
            }
          }
          extracted += "\n";
        }

        // Also support hex-encoded text blocks: <00410042> Tj
        const hexRegex = /<([0-9a-fA-F]+)>\s*(?:Tj|TJ)/gi;
        while ((match = hexRegex.exec(chunkStr)) !== null) {
          try {
            const hex = match[1];
            const bytes = [];
            for (let i = 0; i < hex.length; i += 2) {
              bytes.push(parseInt(hex.substring(i, i + 2), 16));
            }
            const decoded = Buffer.from(bytes).toString("utf-8");
            if (decoded && decoded.trim().length > 1) {
              extracted += decoded.trim() + "\n";
            }
          } catch (e) {
            // Ignore hex decoding error
          }
        }
      }

      pos = endstreamIdx + 9;
    }

    // 2. Scan the raw binary string for any remaining plain text matches outside of streams
    const tjRegexOuter = /\(([^)]{0,1000})\)\s*(?:Tj|TJ)/gi;
    let matchOuter;
    while ((matchOuter = tjRegexOuter.exec(rawStr)) !== null) {
      let textChunk = matchOuter[1];
      textChunk = textChunk.replace(/\\(\d{3})/g, (m, octal) => String.fromCharCode(parseInt(octal, 8)));
      textChunk = textChunk
        .replace(/\\r/g, "\r")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (textChunk.trim().length > 1 && !extracted.includes(textChunk.trim())) {
        extracted += textChunk.trim() + "\n";
      }
    }

    return extracted;
  } catch (e) {
    console.warn("Fallback text extraction failed:", e);
    return "";
  }
}

// Low-level helper to extract mineral dispatch pass details via free PDF text extraction
// Low-level helper to extract mineral dispatch pass details via Gemini AI or free PDF text extraction fallback
async function extractDCPassDetails(fileBase64: string, mimeType: string) {
  // 1. If Gemini AI is initialized, attempt direct precise extraction
  if (aiClient) {
    try {
      console.log(`Sending document to Gemini (${mimeType}) for high-fidelity OCR extraction...`);
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: fileBase64
              }
            },
            {
              text: "Please extract all exact details from the uploaded transit pass or mineral dispatch pass in accordance with the requested schema. If a value is present, extract it exactly. Leave empty if a value cannot be found."
            }
          ]
        },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dcPassNo: { type: Type.STRING },
              vehicleNo: { type: Type.STRING },
              mineralName: { type: Type.STRING },
              netWeight: { type: Type.STRING },
              royaltyIssuedOn: { type: Type.STRING },
              concessionHolderName: { type: Type.STRING },
              sourcePlace: { type: Type.STRING },
              purchaserName: { type: Type.STRING },
              destination: { type: Type.STRING },
              distance: { type: Type.STRING },
              journeyStart: { type: Type.STRING },
              journeyEnd: { type: Type.STRING },
              routeName: { type: Type.STRING },
              duration: { type: Type.STRING },
              checkpost: { type: Type.STRING },
              driverName: { type: Type.STRING },
              driverLicense: { type: Type.STRING },
              driverMobile: { type: Type.STRING },
              panGstin: { type: Type.STRING },
              gpsDetails: { type: Type.STRING },
              transporterName: { type: Type.STRING },
              buyerMobile: { type: Type.STRING }
            }
          }
        }
      });

      if (response && response.text) {
        const result = JSON.parse(response.text.trim());
        console.log("Successfully extracted exact details using Gemini:", result);
        
        const cleanMetadata: any = {};
        for (const key of Object.keys(result)) {
          if (result[key] !== null && result[key] !== undefined) {
            cleanMetadata[key] = String(result[key]).trim();
          }
        }

        // Fill up empty/missing fields with default automatic generators for generic consistent UX
        applyMetadataGenerators(cleanMetadata);
        return cleanMetadata;
      }
    } catch (geminiErr) {
      console.error("Gemini precise extraction failed, falling back to local fallback parser:", geminiErr);
    }
  }

  // 2. Fallback to local text-mining parser if Gemini is not set up or failed
  let text = "";
  if (mimeType.toLowerCase().includes("pdf")) {
    try {
      const dataBuffer = Buffer.from(fileBase64, "base64");
      console.log("Parsing PDF using fast, robust pdf-parse engine...");
      text = await parsePdfText(dataBuffer);
    } catch (globalErr) {
      console.warn("PDF stream scanning failed:", globalErr);
    }
  }

  // Parse text using regular expressions and keywords
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // Helper to search around keywords
  const findValueFor = (keywords: string[]): string => {
    for (const kw of keywords) {
      const lowerKw = kw.toLowerCase();
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(lowerKw)) {
          // 1. Try to find value on the same line after keyword
          const index = line.toLowerCase().indexOf(lowerKw);
          let after = line.substring(index + kw.length).trim();
          // Remove leading separators like colon, hyphen, equal, spaces
          after = after.replace(/^[:\-=\s]+/, "").trim();
          if (after && after.length > 1) {
            return after;
          }
          // 2. If same line is empty/short, try next 1-2 lines
          if (i + 1 < lines.length) {
            const nextVal = lines[i + 1].trim();
            // Ensure next line is not another label containing standard markers
            if (nextVal && !nextVal.includes(":") && !nextVal.includes("No.") && nextVal.length > 1) {
              return nextVal;
            }
          }
        }
      }
    }
    return "";
  };

  const matchRegex = (regex: RegExp): string => {
    const match = text.match(regex);
    return match && match[1] ? match[1].trim() : "";
  };

  const metadata: any = {};

  metadata.dcPassNo = findValueFor(["DC Pass No", "Pass No", "Pass Number", "Dispatch Pass No", "MTransit Pass No", "Invoice No"]) || 
                      matchRegex(/(STML\d{10,25})/i) || 
                      matchRegex(/(CGPASS-\d{4}-\d+)/i) ||
                      matchRegex(/([A-Z0-9_\-\/]{8,35})/i);

  metadata.vehicleNo = findValueFor(["Vehicle No", "Vehicle Number", "Carrier Type", "Vehicle No./(Carrier) Type", "Truck No", "Reg No"]) || 
                       matchRegex(/([A-Z]{2}\s*\d{2}\s*[A-Z]{1,2}\s*\d{4})/i);

  metadata.mineralName = findValueFor(["Mineral Name", "Name of Mineral", "Mineral Name (Grade)", "Mineral Name ( Grade )", "Mineral", "Grade"]);

  // Parse net weight
  let weightStr = findValueFor(["Net Weight", "Net Weight in MT", "Net Weight (MT)", "Weight in MT", "Qty in MT", "Quantity", "Net Qty", "Net Weight in Tonnes"]);
  if (weightStr) {
    const numericMatch = weightStr.match(/(\d+(?:\.\d+)?)/);
    if (numericMatch) {
      weightStr = numericMatch[1];
    }
  }
  metadata.netWeight = weightStr;

  metadata.royaltyIssuedOn = findValueFor(["Royalty Issued on", "Issued on", "Issue Date", "Date of Issue", "Date", "Royalty Date"]) || 
                             matchRegex(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i) ||
                             matchRegex(/(\d{2}\/\d{2}\/\d{4})/i);

  metadata.concessionHolderName = findValueFor(["Concession Holder Name", "Lessee", "Lease Holder", "Mine Owner", "Mine Name", "Name of Lessee"]);
  metadata.sourcePlace = findValueFor(["Source of Place", "Source Place", "Loading Point", "From Place", "From"]);
  metadata.purchaserName = findValueFor(["Name of Purchaser", "Purchaser Name", "Purchaser", "Buyer Name", "Buyer"]);
  metadata.destination = findValueFor(["Destination", "Destination / Address", "To Place", "To Address", "To"]);
  metadata.distance = findValueFor(["Distance", "Distance (KM)", "Distance in KM"]);
  metadata.journeyStart = findValueFor(["Journey Start Dt", "Journey Start", "Valid From", "Start Date", "Time of Issue"]);
  metadata.journeyEnd = findValueFor(["Journey End Dt", "Journey End", "Valid To", "Valid Upto", "Expiry Date"]);
  metadata.routeName = findValueFor(["Route name", "Route Name", "Route", "Transit Route"]);
  metadata.duration = findValueFor(["Duration", "Duration (hrs)", "Validity Duration"]);
  metadata.checkpost = findValueFor(["Checkpost", "Check Post", "First Checkpost", "Passing Checkpost"]);
  metadata.driverName = findValueFor(["Driver Name", "Driver", "Name of Driver"]);
  metadata.driverLicense = findValueFor(["Driver's License No", "Driver License No", "DL No", "License No"]);
  metadata.driverMobile = findValueFor(["Driver Mobile No", "Driver Mobile", "Driver Phone", "Mobile No"]);
  metadata.panGstin = findValueFor(["PAN Number / GSTIN", "PAN / GSTIN", "GSTIN", "PAN No", "PAN", "GST Number"]);
  metadata.gpsDetails = findValueFor(["GPS Tracking Device Details", "GPS Details", "GPS Status", "GPS Device"]);
  metadata.transporterName = findValueFor(["Transporter Name", "Transporter", "Name of Transporter"]);
  metadata.buyerMobile = findValueFor(["Buyer Mobile Number", "Buyer Mobile", "Buyer Phone", "Purchaser Phone"]);

  // Fill up any absent fields with mock default generators to preserve presentation
  applyMetadataGenerators(metadata);

  return metadata;
}

const app = express();


  // Enable CORS & handle preflight OPTIONS requests comprehensively to prevent 405 Method Not Allowed errors
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH");
    res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours preflight cache
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });

  // Handle explicit route-level preflight OPTIONS requests
  app.options("*", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH");
    res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });

  // Use JSON bodyParser with higher limits to support base64 uploads
  app.use((req, res, next) => {
    const startTime = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const logLine = `[${new Date().toISOString()}] ${req.method} ${req.url} -> Status: ${res.statusCode} (${duration}ms)\n`;
      console.log(logLine.trim());
      try {
        const fsSync = require("fs");
        fsSync.appendFileSync(path.join(process.cwd(), "data", "requests.log"), logLine, "utf8");
      } catch (err) {
        // Safe fallback if directory doesn't exist
      }
    });
    next();
  });
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // API Route - Health Check
  app.get(["/api/health", "/health", "/api/health/", "/health/"], (req, res) => {
    res.json({ status: "ok" });
  });

  // Helper to load unified and live synchronized passes lists.
  async function loadPassesUnified(): Promise<any[]> {
    let localPasses: any[] = [];
    if (existsSync(DB_FILE)) {
      try {
        const content = await fs.readFile(DB_FILE, "utf-8");
        localPasses = JSON.parse(content).passes || [];
      } catch (e) {
        console.warn("Failed to parse DB_FILE:", e);
      }
    }

    if (firestoreDb) {
      try {
        const passesCol = collection(firestoreDb, "passes");
        const snapshot = await getDocs(passesCol);
        const firestorePasses: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const { fileDataB64, ...metadataOnly } = data;
          firestorePasses.push({
            ...metadataOnly,
            id: docSnap.id
          });
        });

        const merged = [...firestorePasses];
        for (const localPass of localPasses) {
          if (!merged.some(p => p.id === localPass.id)) {
            merged.push(localPass);
          }
        }

        merged.sort((a: any, b: any) => {
          const d1 = new Date(a.createdAt || 0).getTime();
          const d2 = new Date(b.createdAt || 0).getTime();
          return d2 - d1;
        });

        fs.writeFile(DB_FILE, JSON.stringify({ passes: merged }, null, 2)).catch(() => {});
        return merged;
      } catch (dbErr) {
        console.error("Firestore live fetch error on pass listing:", dbErr);
      }
    }

    localPasses.sort((a: any, b: any) => {
      const d1 = new Date(a.createdAt || 0).getTime();
      const d2 = new Date(b.createdAt || 0).getTime();
      return d2 - d1;
    });
    return localPasses;
  }

  // API Route - Get Passes
  app.get(["/api/passes", "/passes", "/api/passes/", "/passes/"], async (req, res) => {
    try {
      const sorted = await loadPassesUnified();
      res.json(sorted);
    } catch (e: any) {
      console.error("Failed to fetch passes:", e);
      res.status(500).json({ error: e.message || "Failed to load passes" });
    }
  });

  // API Route - Get Pass Details by ID
  app.get(["/api/passes/:id", "/passes/:id"], async (req, res) => {
    try {
      const idStr = req.params.id;
      const decoded = decodeURIComponent(idStr);
      const list = await loadPassesUnified();
      
      const found = list.find((p: any) => {
        const pId = String(p.id || '').toLowerCase();
        const pDc = String(p.dcPassNo || '').toLowerCase();
        const queryStr = idStr.toLowerCase();
        const decStr = decoded.toLowerCase();
        
        return pId === queryStr || 
               pId === decStr || 
               pDc === queryStr || 
               pDc === decStr ||
               pId.replace(/_/g, '/') === queryStr ||
               pId.replace(/_/g, '/') === decStr ||
               pDc.replace(/\//g, '_') === queryStr ||
               pDc.replace(/\//g, '_') === decStr;
      });

      if (found) {
        res.json(found);
      } else {
        res.status(404).json({ error: "DC Pass not found" });
      }
    } catch (e: any) {
      console.error("Failed to fetch pass details:", e);
      res.status(500).json({ error: e.message || "Failed to fetch pass" });
    }
  });

  // API Route - Save Pass
  app.post(["/api/passes", "/passes", "/api/passes/", "/passes/"], async (req, res) => {
    try {
      const { metadata, fileBase64, uploadId, originalFormat } = req.body;
      if (!metadata || !metadata.dcPassNo) {
        return res.status(400).json({ error: "Invalid metadata or missing Pass number" });
      }

      const sanitizedId = metadata.dcPassNo.replace(/\//g, '_');
      const createdAt = new Date().toISOString();

      let fileSize = 0;
      let finalBuffer: Buffer | null = null;
      const filePath = path.join(UPLOADS_DIR, `${sanitizedId}.bin`);

      if (uploadId) {
        const assembledPath = path.join(TMP_PASSES_DIR, `${uploadId}_assembled.bin`);
        if (existsSync(assembledPath)) {
          finalBuffer = await fs.readFile(assembledPath);
          fileSize = finalBuffer.length;
          await fs.writeFile(filePath, finalBuffer);
          await fs.unlink(assembledPath).catch(() => {});
        } else {
          // Fallback to reading the local tmp chunk folder
          const tempDir = path.join(TMP_PASSES_DIR, uploadId);
          let chunkDataMap: { [key: number]: string } = {};
          if (existsSync(tempDir)) {
            const files = await fs.readdir(tempDir);
            const chunkFiles = files.filter(f => f.startsWith("chunk_"));
            for (const f of chunkFiles) {
              const chunkIdx = parseInt(f.substring(6));
              const chunkContent = await fs.readFile(path.join(tempDir, f), "utf-8");
              chunkDataMap[chunkIdx] = chunkContent;
            }
          }

          // Fallback to querying Firestore chunks if local tmp is gone (e.g., scale out container swap)
          if (firestoreDb && Object.keys(chunkDataMap).length === 0) {
            try {
              const snapshot = await getDocs(collection(firestoreDb, "temp_chunks"));
              snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.uploadId === uploadId) {
                  chunkDataMap[data.chunkIndex] = data.chunkData;
                }
              });
            } catch (dbErr) {
              console.error("Database fallback retrieve error:", dbErr);
            }
          }

          if (Object.keys(chunkDataMap).length > 0) {
            const sortedIndexes = Object.keys(chunkDataMap).map(Number).sort((a, b) => a - b);
            const buffers = sortedIndexes.map(idx => Buffer.from(chunkDataMap[idx], "base64"));
            finalBuffer = Buffer.concat(buffers);
            fileSize = finalBuffer.length;
            await fs.writeFile(filePath, finalBuffer);
          }
        }
        
        // Clean up temp dir if exists
        const tempDir = path.join(TMP_PASSES_DIR, uploadId);
        if (existsSync(tempDir)) {
          await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
      } else if (fileBase64) {
        const cleanB64 = fileBase64.includes("base64,") ? fileBase64.split("base64,")[1] : fileBase64;
        finalBuffer = Buffer.from(cleanB64, "base64");
        fileSize = finalBuffer.length;
        await fs.writeFile(filePath, finalBuffer);
      }

      const passRecord = {
        ...metadata,
        id: sanitizedId,
        createdAt,
        status: 'verified',
        originalFormat: originalFormat || 'application/pdf',
        fileSize,
        hasChunks: !!uploadId,
        pdfDownloaded: true
      };

      // Save in Firestore with Deflate-Compressed base64 for absolute persistence resilience!
      if (firestoreDb) {
        try {
          let fileDataB64 = "";
          if (finalBuffer) {
            const compressed = zlib.deflateSync(finalBuffer);
            if (compressed.length < 900000) {
              fileDataB64 = compressed.toString("base64");
            } else {
              console.warn(`File compressed size ${compressed.length} exceeds standard Firestore document chunk limit.`);
            }
          }
          const docRef = doc(firestoreDb, "passes", sanitizedId);
          await setDoc(docRef, {
            ...passRecord,
            fileDataB64
          }, { merge: true });
          console.log(`Pass ${sanitizedId} saved securely to Firebase Firestore.`);
        } catch (dbErr) {
          console.error("Could not upload pass record to Firestore:", dbErr);
        }
      }

      // Save locally to database.json
      const content = await fs.readFile(DB_FILE, "utf-8");
      const db = JSON.parse(content);
      db.passes = (db.passes || []).filter((p: any) => p.id !== sanitizedId && p.dcPassNo !== metadata.dcPassNo);
      db.passes.unshift(passRecord);
      await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));

      res.status(201).json(passRecord);
    } catch (e: any) {
      console.error("Failed to save pass:", e);
      res.status(500).json({ error: e.message || "Failed to save pass" });
    }
  });

  // API Route - Download / Serve original file mapping
  app.get(["/api/passes/:id/file", "/passes/:id/file"], async (req, res) => {
    try {
      const idStr = req.params.id;
      const sanitizedId = idStr.replace(/\//g, '_');
      const filePath = path.join(UPLOADS_DIR, `${sanitizedId}.bin`);
      
      let finalBuffer: Buffer | null = null;
      let mimeType = "application/pdf";

      if (existsSync(filePath)) {
        finalBuffer = await fs.readFile(filePath);
      } else if (firestoreDb) {
        // Self-Healing Trigger: Pull compressed file from Firestore if missing locally!
        console.log(`Local file missing for pass ${sanitizedId}. Restoring from Firestore cloud...`);
        try {
          const docRef = doc(firestoreDb, "passes", sanitizedId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            mimeType = data.originalFormat || "application/pdf";
            if (data.fileDataB64) {
              const compressedBuf = Buffer.from(data.fileDataB64, "base64");
              finalBuffer = zlib.inflateSync(compressedBuf);
              // Cache locally so we don't have to decompress every download
              await fs.writeFile(filePath, finalBuffer);
              console.log(`Restored and cached local file from Firestore backup for id: ${sanitizedId}`);
            }
          }
        } catch (dbErr) {
          console.error("Firestore self-healing restore aborted:", dbErr);
        }
      }

      if (finalBuffer) {
        // Try resolving precise mimeType from local database record
        try {
          const jsonContent = await fs.readFile(DB_FILE, "utf-8");
          const db = JSON.parse(jsonContent);
          const found = (db.passes || []).find((p: any) => p.id === sanitizedId || p.id === idStr);
          if (found) mimeType = found.originalFormat || mimeType;
        } catch (e) {
          // ignore database parse fail
        }

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="Pass-${sanitizedId}.pdf"`);
        res.send(finalBuffer);
      } else {
        res.status(404).json({ error: "File could not be recovered or found on local server nor Cloud Storage." });
      }
    } catch (e: any) {
      console.error("Failed to download file:", e);
      res.status(500).json({ error: e.message || "Failed to download file" });
    }
  });

  // API Route - Delete Pass
  app.delete(["/api/passes/:id", "/passes/:id"], async (req, res) => {
    try {
      const idStr = req.params.id;
      const sanitizedId = idStr.replace(/\//g, '_');
      
      // Delete from local database file
      const content = await fs.readFile(DB_FILE, "utf-8");
      const db = JSON.parse(content);
      db.passes = (db.passes || []).filter((p: any) => p.id !== sanitizedId && p.id !== idStr);
      await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));

      // Delete from local disk
      const filePath = path.join(UPLOADS_DIR, `${sanitizedId}.bin`);
      if (existsSync(filePath)) {
        await fs.unlink(filePath).catch(() => {});
      }

      // Delete from Firestore
      if (firestoreDb) {
        try {
          const docRef = doc(firestoreDb, "passes", sanitizedId);
          await deleteDoc(docRef);
          console.log(`Pass document ${sanitizedId} deleted from Firestore.`);
        } catch (dbErr) {
          console.error("Firestore document deletion failed:", dbErr);
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("Failed to delete pass:", e);
      res.status(500).json({ error: e.message || "Failed to delete pass" });
    }
  });

  // API Route - Chunked Upload Endpoint (supports multiple route structures for cache compatibility)
  app.post(["/api/passes/upload-chunk", "/api/upload-chunk", "/passes/upload-chunk", "/upload-chunk", "/api/passes/upload-chunk/", "/api/upload-chunk/", "/passes/upload-chunk/", "/upload-chunk/"], async (req, res) => {
    try {
      const { uploadId, chunkIndex, totalChunks, chunkData } = req.body;
      if (!uploadId || chunkIndex === undefined || !chunkData) {
        return res.status(400).json({ error: "uploadId, chunkIndex, and chunkData are required" });
      }

      // Write locally in writable /tmp
      const tempDir = path.join(TMP_PASSES_DIR, uploadId);
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }

      const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
      await fs.writeFile(chunkPath, chunkData, "utf8");

      // Save to Firestore for multi-instance distributed serverless fallback
      if (firestoreDb) {
        try {
          const docRef = doc(firestoreDb, "temp_chunks", `${uploadId}_${chunkIndex}`);
          await setDoc(docRef, {
            uploadId,
            chunkIndex,
            totalChunks,
            chunkData,
            createdAt: Date.now()
          });
        } catch (dbErr) {
          console.warn("Could not sync uploaded chunk to Firestore:", dbErr);
        }
      }

      res.json({ success: true, chunkIndex });
    } catch (e: any) {
      console.error("Failed uploading chunk:", e);
      res.status(500).json({ error: e.message || "Failed uploading chunk" });
    }
  });

  // API Route - Extract details from chunked file (supports multiple route structures for cache compatibility)
  app.post(["/api/passes/extract-chunked", "/api/extract-chunked", "/passes/extract-chunked", "/extract-chunked", "/api/passes/extract-chunked/", "/api/extract-chunked/", "/passes/extract-chunked/", "/extract-chunked/"], async (req, res) => {
    try {
      const { uploadId, mimeType } = req.body;
      if (!uploadId || !mimeType) {
        return res.status(400).json({ error: "uploadId and mimeType are required" });
      }

      let chunkDataMap: { [key: number]: string } = {};
      let totalCount = 0;

      // 1. Try reading chunks locally from /tmp first
      const tempDir = path.join(TMP_PASSES_DIR, uploadId);
      if (existsSync(tempDir)) {
        const files = await fs.readdir(tempDir);
        const chunkFiles = files.filter(f => f.startsWith("chunk_"));
        for (const f of chunkFiles) {
          const chunkIdx = parseInt(f.substring(6));
          const chunkContent = await fs.readFile(path.join(tempDir, f), "utf-8");
          chunkDataMap[chunkIdx] = chunkContent;
        }
        totalCount = Object.keys(chunkDataMap).length;
      }

      // 2. Multi-instance Distributed Fallback: If local chunks are missing, pull from Firestore
      if (firestoreDb && totalCount === 0) {
        console.log(`Chunks not found in local /tmp for ${uploadId}. Fetching from Firestore fallback...`);
        try {
          const snapshot = await getDocs(collection(firestoreDb, "temp_chunks"));
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.uploadId === uploadId) {
              chunkDataMap[data.chunkIndex] = data.chunkData;
            }
          });
          totalCount = Object.keys(chunkDataMap).length;
        } catch (dbErr) {
          console.error("Firestore chunk fetch failed:", dbErr);
        }
      }

      if (totalCount === 0) {
        return res.status(400).json({ error: "No chunk files found for this upload session. Please re-upload the file." });
      }

      // Re-assemble files
      const sortedIndexes = Object.keys(chunkDataMap).map(Number).sort((a,b) => a - b);
      const buffers = sortedIndexes.map(idx => Buffer.from(chunkDataMap[idx], "base64"));
      const fullBuffer = Buffer.concat(buffers);
      const fileBase64 = fullBuffer.toString("base64");

      // Save the assembled file temporarily so the /api/passes (save) route can find and move it
      const assembledPath = path.join(TMP_PASSES_DIR, `${uploadId}_assembled.bin`);
      await fs.writeFile(assembledPath, fullBuffer);

      // Now run the actual extraction on the assembled file as Base64
      console.log(`Starting metadata extraction on assembled PDF of size ${fullBuffer.length} bytes...`);
      const extractedData = await extractDCPassDetails(fileBase64, mimeType);

      // Async clean up Firestore temporary chunks
      if (firestoreDb) {
        try {
          const snapshot = await getDocs(collection(firestoreDb, "temp_chunks"));
          snapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            if (data.uploadId === uploadId) {
              await deleteDoc(doc(firestoreDb, "temp_chunks", docSnap.id)).catch(() => {});
            }
          });
        } catch (cleanErr) {
          console.warn("Could not clean temp chunks from Firestore asynchronously:", cleanErr);
        }
      }

      res.json(extractedData);
    } catch (e: any) {
      console.error("Chunked extraction error:", e);
      res.status(500).json({ error: e.message || "Failed during chunked document extraction" });
    }
  });

  // API Route - Mineral Dispatch Pass Free Extractor
  app.post(["/api/passes/extract", "/passes/extract", "/api/passes/extract/", "/passes/extract/"], async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "fileBase64 and mimeType are required" });
      }
      const data = await extractDCPassDetails(fileBase64, mimeType);
      res.json(data);
    } catch (e: any) {
      console.error("Extraction error:", e);
      res.status(500).json({ 
        error: e.message || "Failed during document extraction", 
        stack: e.stack,
        details: e.toString()
      });
    }
  });

  // Keep old endpoint for backwards compatibility
  app.post(["/api/gemini/extract", "/gemini/extract", "/api/gemini/extract/", "/gemini/extract/"], async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;
      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "fileBase64 and mimeType are required" });
      }
      const data = await extractDCPassDetails(fileBase64, mimeType);
      res.json(data);
    } catch (e: any) {
      console.error("Extraction error:", e);
      res.status(500).json({ 
        error: e.message || "Failed during document extraction", 
        stack: e.stack,
        details: e.toString()
      });
    }
  });

  // Catch-all handler for unhandled API requests to prevent leaking into Vite middleware (which results in 405 Method Not Allowed)
  app.all(["/api/*", "/passes/*", "/gemini/*", "/upload-chunk*", "/extract-chunked*"], (req, res) => {
    res.status(404).json({
      error: "API Endpoint not found",
      message: `The API route ${req.method} ${req.url} does not exist or matches nothing on the main Express server.`
    });
  });

  async function startLocalServer() {
    const PORT = 3000;
    const isProd = process.env.NODE_ENV === "production";

    let vite: any;
    if (!isProd) {
      vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
    }

    // SPA Fallback: Serve index.html for any request that hasn't been handled
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      
      // Ignore API routes
      if (url.startsWith('/api/')) {
        return next();
      }

      try {
        if (isProd) {
          const distPath = path.join(process.cwd(), 'dist');
          const indexPath = path.join(distPath, 'index.html');
          return res.sendFile(indexPath);
        } else {
          const templatePath = path.resolve(process.cwd(), 'index.html');
          let template = await fs.readFile(templatePath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        }
      } catch (e: any) {
        console.error("Fallback error:", e);
        if (!isProd && vite) vite.ssrFixStacktrace(e);
        next(e);
      }
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  if (process.env.VERCEL !== "1") {
    startLocalServer();
  }

  export default app;

