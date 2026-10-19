const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');

// Multer in-memory storage for receipt & payment images (up to 20MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// POST /api/receipt/scan
const scanReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('PASTE_') || apiKey.length < 10) {
      return res.status(503).json({
        success: false,
        message: 'Gemini API key not configured. Add a valid GEMINI_API_KEY in backend/.env',
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-3.8-flash
    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype || 'image/jpeg',
      },
    };

    const prompt = `You are an expert financial document and payment receipt analyzer.
Analyze this image, which may be:
- A digital UPI payment screenshot (Google Pay, Paytm, PhonePe, BHIM, CRED, Amazon Pay, bank transfer)
- A restaurant bill, store receipt, shopping invoice, or taxi receipt.

Extract:
1. "totalAmount": The final paid amount as a pure number (no currency symbol, no commas like "25,000" -> 25000).
2. "storeName": The recipient name, merchant name, or store name (e.g. "BLOSSOM EDUCATIONAL SOCIETY", "Paytm", "Starbucks").
3. "items": List of line items or payment description with price if available.

Return ONLY a raw JSON object with this exact structure (no markdown, no backticks, no comments):
{"totalAmount": 0, "storeName": "Merchant Name", "items": [{"name": "item description", "price": 0, "quantity": 1}]}

If no items are listed, items can be: [{"name": "Payment", "price": totalAmount, "quantity": 1}].
If the amount has decimals or commas, convert it to a standard JavaScript number (e.g. 25000 or 100.00).`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();

    // Strip any markdown code fences if present
    const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(422).json({ success: false, message: 'Could not parse receipt — please try a clearer image' });
    }

    let parsed = JSON.parse(jsonMatch[0]);

    // Ensure totalAmount is a clean number
    if (typeof parsed.totalAmount === 'string') {
      parsed.totalAmount = parseFloat(parsed.totalAmount.replace(/[^0-9.]/g, '')) || 0;
    }

    res.json({ success: true, receipt: parsed });
  } catch (error) {
    console.error('Gemini receipt scan error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message?.includes('API_KEY') || error.message?.includes('not found')
        ? 'Invalid Gemini API key. Check GEMINI_API_KEY in backend/.env'
        : 'Receipt scanning failed: ' + error.message,
    });
  }
};

module.exports = { scanReceipt, upload };
