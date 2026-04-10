const express = require("express");
const crypto = require("crypto");

const router = express.Router();

// =========================================================
// ERV Mock Service Helper Functions
// =========================================================

/**
 * Generates a SOAP envelope wrapper with XML declaration and namespace.
 * @param {string} content - The SOAP body content
 * @returns {string} Complete SOAP XML response
 */
function createSoapEnvelope(content) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://www.signaling.at/erv" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SOAP-ENV:Body>
    ${content}
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

/**
 * Generates a mock Empfangsbestaetigung (Receipt) response.
 * This simulates the court's acknowledgment of a sent lawsuit or document.
 * @returns {string} SOAP-formatted XML response
 */
function createNachrichtResponse() {
  const messageId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const responseBody = `<tns:SendNachrichtResponse>
      <tns:Empfangsbestaetigung>
        <tns:NachrichtenID>${messageId}</tns:NachrichtenID>
        <tns:Zeitstempel>${timestamp}</tns:Zeitstempel>
        <tns:Status>Erfolgreich empfangen</tns:Status>
        <tns:Beschreibung>Die Nachricht wurde erfolgreich vom ERV-System empfangen und wird verarbeitet.</tns:Beschreibung>
      </tns:Empfangsbestaetigung>
    </tns:SendNachrichtResponse>`;

  return createSoapEnvelope(responseBody);
}

/**
 * Creates a mock court/authority lookup response.
 * Simulates searching for an official ERV code (Anschriftcode).
 * @returns {string} SOAP-formatted XML response
 */
function createAnschriftcodeResponse() {
  const responseBody = `<tns:GetAnschriftcodeResponse>
      <tns:Gerichtsinformationen>
        <tns:Gericht>Landesgericht für Zivilrechtssachen Wien</tns:Gericht>
        <tns:Anschriftcode>Z123456789</tns:Anschriftcode>
        <tns:EMail>eingang@lg-wien.justiz.gv.at</tns:EMail>
        <tns:Status>Aktiv</tns:Status>
        <tns:Bundesland>Wien</tns:Bundesland>
        <tns:Gerichtstyp>Landesgericht</tns:Gerichtstyp>
      </tns:Gerichtsinformationen>
    </tns:GetAnschriftcodeResponse>`;

  return createSoapEnvelope(responseBody);
}

/**
 * Creates a mock configuration/health check response.
 * Simulates a system status query.
 * @returns {string} SOAP-formatted XML response
 */
function createKonfigurationResponse() {
  const responseBody = `<tns:GetKonfigurationResponse>
      <tns:Systemstatus>
        <tns:Status>OK</tns:Status>
        <tns:Version>2.0</tns:Version>
        <tns:Zeitstempel>${new Date().toISOString()}</tns:Zeitstempel>
        <tns:Verbindung>Stabil</tns:Verbindung>
        <tns:DatabaseStatus>Aktiv</tns:DatabaseStatus>
        <tns:Nachricht>Elektronischer Rechtsverkehr (ERV) Testumgebung bereit</tns:Nachricht>
      </tns:Systemstatus>
    </tns:GetKonfigurationResponse>`;

  return createSoapEnvelope(responseBody);
}

// =========================================================
// ERV Mock Service Endpoints
// =========================================================

/**
 * Test Endpoint - Verify ERV service is running
 */
router.post(["/test", "/health"], (req, res) => {
  console.log("[ERV] Test endpoint called");
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.json({ status: "OK", message: "ERV service is running", timestamp: new Date().toISOString() });
});

/**
 * POST /services/ERVNachrichtPort
 * Accepts SOAP requests to send/receive messages (litigation documents).
 * Returns a mock receipt with a generated Message ID (NachrichtenID).
 */
router.post("/ERVNachrichtPort", (req, res) => {
  try {
    console.log(`[ERV] ERVNachrichtPort called`);
    console.log(`[ERV] Request method: ${req.method}`);
    console.log(`[ERV] Request path: ${req.path}`);
    console.log(`[ERV] Content-Type: ${req.get('Content-Type')}`);
    console.log(`[ERV] Body type: ${typeof req.body}`);
    
    // Input parsing: the SOAP request body is received as a text string
    const requestBody = req.body;
    
    if (!requestBody) {
      console.warn("[ERV] No request body received!");
      return res.status(400).set("Content-Type", "text/xml; charset=utf-8").send(`<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <SOAP-ENV:Fault>
      <faultcode>Client</faultcode>
      <faultstring>No request body provided</faultstring>
    </SOAP-ENV:Fault>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`);
    }
    
    console.log(`[ERV] Request body (first 300 chars): ${String(requestBody).substring(0, 300)}`);

    // Generate and return mock response
    const soapResponse = createNachrichtResponse();
    
    console.log(`[ERV] Sending response (${soapResponse.length} bytes)`);

    res.set("Content-Type", "text/xml; charset=utf-8");
    res.status(200).send(soapResponse);
  } catch (error) {
    console.error("[ERV] ERVNachrichtPort error:", error);
    res.set("Content-Type", "text/xml; charset=utf-8");
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <SOAP-ENV:Fault>
      <faultcode>Server</faultcode>
      <faultstring>Internal Server Error</faultstring>
      <detail>${error.message}</detail>
    </SOAP-ENV:Fault>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`);
  }
});

/**
 * POST /services/ERVAnschriftcodePort
 * Accepts requests to look up a court's official ERV code (Anschriftcode).
 * Returns mock lookup results with court information.
 */
router.post("/ERVAnschriftcodePort", (req, res) => {
  try {
    const requestBody = req.body;
    console.log("ERVAnschriftcodePort received request:", requestBody.substring(0, 200) + "...");

    const soapResponse = createAnschriftcodeResponse();

    res.set("Content-Type", "text/xml; charset=utf-8");
    res.status(200).send(soapResponse);
  } catch (error) {
    console.error("ERVAnschriftcodePort error:", error);
    res.set("Content-Type", "text/xml; charset=utf-8");
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <SOAP-ENV:Fault>
      <faultcode>Server</faultcode>
      <faultstring>Internal Server Error</faultstring>
      <detail>${error.message}</detail>
    </SOAP-ENV:Fault>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`);
  }
});

/**
 * POST /services/ERVKonfigurationPort
 * Accepts configuration/metadata queries.
 * Returns system status and version information.
 */
router.post("/ERVKonfigurationPort", (req, res) => {
  try {
    const requestBody = req.body;
    console.log("ERVKonfigurationPort received request:", requestBody.substring(0, 200) + "...");

    const soapResponse = createKonfigurationResponse();

    res.set("Content-Type", "text/xml; charset=utf-8");
    res.status(200).send(soapResponse);
  } catch (error) {
    console.error("ERVKonfigurationPort error:", error);
    res.set("Content-Type", "text/xml; charset=utf-8");
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <SOAP-ENV:Fault>
      <faultcode>Server</faultcode>
      <faultstring>Internal Server Error</faultstring>
      <detail>${error.message}</detail>
    </SOAP-ENV:Fault>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`);
  }
});

module.exports = router;
