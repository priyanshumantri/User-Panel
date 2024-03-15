const express = require("express")
const Route = express.Router()
const ejs = require("ejs");
const fs = require("fs");
const puppeteer = require("puppeteer");
const { PDFDocument } = require('pdf-lib');
const path = require("path")
const ledgerSchema = require("../../models/masters/ledgers")

Route.post("/export/pdf", async(req, res)=> {
    const db = req.dbConnection;
    const ledgers = db.model("ledgers", ledgerSchema)
    const ledgerData = await ledgers.findById(req.body.ledger)
    const templatePath = "./views/templates/pdf.ejs";
    const template = fs.readFileSync(templatePath, "utf-8");
    const html = ejs.render(template, { data: req.body.data, ledger : req.body.ledger ? true : false });
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();  
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: 'screenshot.png' });

    // Capture a PDF of the entire page
    await page.pdf({
        path: path.join(__dirname, `/../../public/${ledgerData.name}.pdf`),
        format: 'A4', // Specify the format to match legal paper size
        margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
        preferCSSPageSize: true,// Include background colors and images
        printBackground : true
    });

    await browser.close();

    res.set({
        'Content-Disposition': `attachment; filename="${ledgerData.name}.pdf"`,
        'Content-Type': 'application/pdf'
    });
    return res.status(200).send({ message: "https://"+req.get("host")+`/${ledgerData.name}.pdf`})
})

module.exports = Route