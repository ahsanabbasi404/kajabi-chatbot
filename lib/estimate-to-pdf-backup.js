const fs = require('fs');
const path = require('path');
const EstimateGenerator = require('./estimate-generator');

/**
 * Generate PDF using puppeteer-core for serverless environments
 * This preserves 100% HTML styling like regular Puppeteer but works in serverless
 * @param {Object} data - The estimate data
 * @returns {Buffer} - PDF buffer
 */
async function generateEstimatePDFBackup(data) {
  let browser;
  try {
    console.log('Generating PDF estimate using serverless-compatible Puppeteer...');
    
    // Format client info for EstimateGenerator
    // Handle both 'to' field and separate client fields
    let clientInfo = '';
    if (data.to) {
      clientInfo = data.to;
    } else {
      clientInfo = [data.clientName, data.clientCompany, data.clientAddress, data.clientCity]
        .filter(Boolean)
        .join('\n');
    }
    
    // Prepare data for EstimateGenerator
    const estimateData = {
      companyName: data.companyName,
      companyTagline: data.companyTagline,
      companyAddress: data.companyAddress,
      estimateNumber: data.estimateNumber,
      estimateDate: data.estimateDate,
      to: clientInfo,
      clientInfo: clientInfo, // Keep for backward compatibility
      jobName: data.jobName,
      items: data.items
    };
    
    // Generate HTML using EstimateGenerator
    const generator = new EstimateGenerator();
    const htmlPath = generator.generateEstimate(estimateData);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Detect environment and configure Puppeteer accordingly
    const isServerless = !!(process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
    
    let puppeteer, launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    
    if (isServerless) {
      console.log('Detected serverless environment, using optimized configuration...');
      
      // Try to load @sparticuz/chromium for serverless environments
      try {
        const chromium = require('@sparticuz/chromium');
        puppeteer = require('puppeteer-core');
        
        launchOptions = {
          ...launchOptions,
          args: chromium.args,
          executablePath: await chromium.executablePath(),
        };
        
        console.log('Using @sparticuz/chromium for serverless compatibility');
      } catch (chromiumError) {
        console.log('@sparticuz/chromium not available, falling back to puppeteer-core with system Chrome');
        puppeteer = require('puppeteer-core');
        
        // Try common Chrome/Chromium paths for serverless environments
        const possiblePaths = [
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          process.env.CHROME_EXECUTABLE_PATH
        ].filter(Boolean);
        
        let executablePath = null;
        for (const chromePath of possiblePaths) {
          if (fs.existsSync(chromePath)) {
            executablePath = chromePath;
            break;
          }
        }
        
        if (executablePath) {
          launchOptions.executablePath = executablePath;
        } else {
          throw new Error('No Chrome/Chromium executable found in serverless environment');
        }
      }
    } else {
      console.log('Using local Puppeteer installation');
      puppeteer = require('puppeteer');
    }
    
    // Launch browser
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Write HTML content to a temporary file and navigate to it
    // This ensures proper base URL resolution for images
    const isServerlessEnv = !!(process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
    const outputDir = isServerlessEnv ? '/tmp' : path.join(process.cwd(), 'htmls-date');
    
    // Ensure output directory exists (only for local development)
    if (!isServerlessEnv && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const tempHtmlPath = path.join(outputDir, `temp-estimate-backup-${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');
    
    // Navigate to the file URL for proper image loading
    const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;
    await page.goto(fileUrl, {
      waitUntil: 'networkidle0'
    });
    
    // Generate PDF buffer
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });
    
    await browser.close();
    
    // Clean up temporary HTML files
    try {
      fs.unlinkSync(htmlPath);
    } catch (cleanupError) {
      console.warn('Could not delete temporary HTML file:', cleanupError.message);
    }
    
    try {
      fs.unlinkSync(tempHtmlPath);
    } catch (cleanupError) {
      console.warn('Warning: Could not clean up temporary HTML file:', cleanupError.message);
    }
    
    console.log(`✅ PDF generated successfully using serverless-compatible Puppeteer!`);
    console.log(`📊 PDF size: ${pdfBuffer.length} bytes`);
    console.log(`🏷️  Estimate Number: ${data.estimateNumber || 'N/A'}`);
    
    // Calculate total for logging
    const total = data.items ? data.items.reduce((sum, item) => sum + (item.amount || (item.units * item.cost) || 0), 0) : 0;
    console.log(`💰 Total Amount: $${total.toFixed(2)}`);
    
    return pdfBuffer;
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('Error generating PDF with serverless backup method:', error);
    throw error;
  }
}

/**
 * Test function for the serverless backup PDF generator
 */
async function testGenerateEstimatePDFBackup() {
  const testData = {
    companyName: 'TechSolutions Inc.',
    companyTagline: 'Innovation at its finest',
    companyAddress: 'TechSolutions Inc.\n123 Tech Street\nSilicon Valley, CA 94000',
    estimateNumber: '00030',
    estimateDate: '12/15/2024',
    clientName: 'John Doe',
    clientCompany: 'XYZ Corporation',
    clientAddress: '456 Business Ave',
    clientCity: 'Business City, BC 67890',
    jobName: 'Network Infrastructure Upgrade',
    items: [
      { description: 'Cisco Router 2900 Series', units: 5, cost: 1200, amount: 6000 },
      { description: 'Cat6 Ethernet Cables (100ft)', units: 20, cost: 25, amount: 500 },
      { description: 'Network Switch 24-Port', units: 3, cost: 800, amount: 2400 },
      { description: 'Installation & Configuration', units: 16, cost: 150, amount: 2400 },
      { description: 'Testing & Documentation', units: 8, cost: 100, amount: 800 }
    ]
  };
  
  try {
    const pdfBuffer = await generateEstimatePDFBackup(testData);
    
    // Save to file for testing
    const outputPath = path.join(__dirname, 'htmls-date', 'generated-estimate-backup.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    
    console.log(`PDF generated successfully: ${outputPath}`);
    console.log(`PDF size: ${pdfBuffer.length} bytes`);
    
    // Create timestamped copy
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const timestampedPath = path.join(__dirname, 'htmls-date', `test-estimate-backup-${timestamp}.pdf`);
    fs.writeFileSync(timestampedPath, pdfBuffer);
    console.log(`Timestamped copy saved: ${timestampedPath}`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

module.exports = { generateEstimatePDFBackup };

// Run test if this file is executed directly
if (require.main === module) {
  testGenerateEstimatePDFBackup();
}