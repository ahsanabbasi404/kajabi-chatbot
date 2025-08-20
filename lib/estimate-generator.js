const fs = require('fs');
const path = require('path');

/**
 * Estimate Generator - A reusable script to generate HTML estimates
 * from the template with dynamic data
 */
class EstimateGenerator {
  constructor(templatePath = null) {
    // Use process.cwd() for serverless compatibility
    const projectRoot = process.cwd();
     
    this.templatePath = templatePath || path.join(projectRoot, 'public', 'Sample Estimate Output (1).html');
    
    // For serverless environments, use /tmp directory
    const isServerless = !!(process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
    this.outputDir = isServerless ? '/tmp' : path.join(projectRoot, 'htmls-date');
    
    // Ensure output directory exists (only for local development)
    if (!isServerless && !fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate a new estimate HTML file with provided data
   * @param {Object} data - The estimate data
   * @param {string} data.companyName - Company name
   * @param {string} data.companyTagline - Company tagline
   * @param {string} data.companyAddress - Company address lines (use \n for line breaks)
   * @param {string} data.estimateNumber - Estimate number
   * @param {string} data.estimateDate - Estimate date
   * @param {string} data.clientInfo - Client information
   * @param {string} data.jobName - Job/project name
   * @param {Array} data.items - Array of estimate items
   * @param {string} data.items[].description - Item description
   * @param {number} data.items[].units - Number of units
   * @param {number} data.items[].cost - Cost per unit
   * @param {number} data.items[].amount - Total amount (units * cost)
   * @param {string} filename - Output filename (optional)
   * @returns {string} - Path to generated HTML file
   */
  generateEstimate(data, filename = null) {
    try {
      // Read template
      const template = fs.readFileSync(this.templatePath, 'utf8');
      
      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        filename = `estimate-${data.estimateNumber || 'unknown'}-${timestamp}.html`;
      }
      
      // Calculate total
      const total = data.items ? data.items.reduce((sum, item) => sum + (item.amount || 0), 0) : 0;
      
      // Replace company information
      let html = template
        .replace(/Southeastern Lighting Solutions/g, data.companyName || 'Southeastern Lighting Solutions')
        .replace(/Experts in earning trusts/g, data.companyTagline || 'Experts in earning trusts')
        .replace(/Southeastern Lighting Solutions<br>\s*1838 Mason Ave\.<\/p>\s*<p class=MsoNormal>Daytona Beach, Fl 32117/g, 
          this.formatAddress(data.companyAddress || 'Southeastern Lighting Solutions<br>1838 Mason Ave.</p>\n  <p class=MsoNormal>Daytona Beach, Fl 32117'))
        .replace(/00012/g, data.estimateNumber || '00012')
        // update with latest date today
        .replace(/1\/30\/23/g, new Date().toLocaleDateString('en-US'))
        .replace(/Consultation services/g, data.jobName || 'Consultation services')
        .replace(/Sample%20Estimate%20Output%20\(1\)_files\/image001\.png/g, 'image001.png');
      
      // Add client information
      if (data.to || data.clientInfo) {
        const clientInfo = data.to || data.clientInfo;
        html = html.replace(/<h2>To:<\/h2>\s*<p class=MsoNormal>&nbsp;<\/p>/, 
          `<h2>To:</h2>\n  <p class=MsoNormal>${clientInfo.replace(/\n/g, '<br>')}</p>`);
      }
      
      // Generate table rows for items
      const tableRows = this.generateTableRows(data.items || []);
      
      // Replace empty table rows with actual data (keep header and total)
      // Find all empty data rows and replace them with our data
      const emptyRowPattern = /<tr style='height:17\.65pt'>\s*<td[^>]*>\s*<p class=MsoNormal[^>]*>&nbsp;<\/p>\s*<\/td>\s*<td[^>]*>\s*<p class=MsoNormal[^>]*>&nbsp;<\/p>\s*<\/td>\s*<td[^>]*>\s*<p class=Amount[^>]*>&nbsp;<\/p>\s*<\/td>\s*<td[^>]*>\s*<p class=Amount[^>]*>&nbsp;<\/p>\s*<\/td>\s*<\/tr>/g;
      
      // Find all empty rows and replace them all at once with our data
      const emptyRows = html.match(emptyRowPattern);
      if (emptyRows && emptyRows.length > 0) {
        // Replace all empty rows with our data rows
        const allEmptyRowsPattern = new RegExp(emptyRows.map(row => row.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'), 'g');
        html = html.replace(allEmptyRowsPattern, tableRows);
      }
      
      // Update total - find the total amount cell and replace it
      const totalPattern = /<p class=RightAlignedCxSpLast[^>]*><b><span style='color:#003D59'>[^<]*<\/span><\/b><\/p>/;
      html = html.replace(totalPattern, 
        `<p class=RightAlignedCxSpLast align=center style='text-align:center;line-height:normal'><b><span style='color:#003D59'>$${total.toFixed(2)}</span></b></p>`);
      
      // Write to file
      const outputPath = path.join(this.outputDir, filename);
      fs.writeFileSync(outputPath, html, 'utf8');
      
      console.log(`Estimate generated successfully: ${outputPath}`);
      return outputPath;
      
    } catch (error) {
      console.error('Error generating estimate:', error);
      throw error;
    }
  }
  
  /**
   * Format company address for HTML
   */
  formatAddress(address) {
    if (!address) return '';
    return address.replace(/\n/g, '<br>\n  ');
  }
  
  /**
   * Generate table rows for estimate items
   */
  generateTableRows(items) {
    if (!items || items.length === 0) {
      return ' <tr style=\'height:17.65pt\'>\n  <td width=318 style=\'width:238.5pt;border-top:none;border-left:none;border-bottom:solid #3C8F89 1.0pt;border-right:solid #3C8F89 1.0pt;padding:0in 5.4pt 0in 5.4pt;height:17.65pt\'>\n  <p class=MsoNormal style=\'line-height:normal\'>No items</p>\n  </td>\n  <td width=118 style=\'width:88.5pt;border-top:none;border-left:none;border-bottom:solid #3C8F89 1.0pt;border-right:solid #3C8F89 1.0pt;padding:0in 5.4pt 0in 5.4pt;height:17.65pt\'>\n  <p class=MsoNormal align=center style=\'text-align:center;line-height:normal\'>-</p>\n  </td>\n  <td width=122 style=\'width:91.5pt;border-top:none;border-left:none;border-bottom:solid #3C8F89 1.0pt;border-right:solid #3C8F89 1.0pt;padding:0in 5.4pt 0in 5.4pt;height:17.65pt\'>\n  <p class=Amount align=center style=\'text-align:center;line-height:normal\'>-</p>\n  </td>\n  <td width=114 style=\'width:85.5pt;border:none;border-bottom:solid #3C8F89 1.0pt;padding:0in 5.4pt 0in 5.4pt;height:17.65pt\'>\n  <p class=Amount align=center style=\'text-align:center;line-height:normal\'>$0.00</p>\n  </td>\n </tr>';
    }
    
    return items.map(item => {
      const description = item.description || '';
      const units = item.units || 0;
      const cost = item.cost || 0;
      const amount = item.amount || (units * cost);
      
      return ` <tr style='height:17.65pt'>
  <td width=318 style='width:238.5pt;border-top:none;border-left:none;border-bottom:solid #3C8F89 1.0pt;border-right:solid #3C8F89 1.0pt;padding:0in 5.4pt 0in 5.4pt;height:17.65pt'>
  <p class=MsoNormal style='line-height:normal'>${description}</p>
  </td>
  <td width=118 style='width:88.5pt;border-top:none;border-left:none;border-bottom:solid #3C8F89 1.0pt;border-right:solid #3C8F89 1.0pt;padding:0in 5.4pt 0in 5.4pt;height:17.65pt'>
  <p class=MsoNormal align=center style='text-align:center;line-height:normal'>${units}</p>
  </td>
  <td width=122 style='width:91.5pt;border-top:none;border-left:none;border-bottom:solid #3C8F89 1.0pt;border-right:solid #3C8F89 1.0pt;padding:0in 5.4pt 0in 5.4pt;height:17.65pt'>
  <p class=Amount align=center style='text-align:center;line-height:normal'>$${cost.toFixed(2)}</p>
  </td>
  <td width=114 style='width:85.5pt;border:none;border-bottom:solid #3C8F89 1.0pt;padding:0in 5.4pt 0in 5.4pt;height:17.65pt'>
  <p class=Amount align=center style='text-align:center;line-height:normal'>$${amount.toFixed(2)}</p>
  </td>
 </tr>`;
    }).join('\n');
  }
}

// Export for use in other modules
module.exports = EstimateGenerator;

// Example usage and test function
if (require.main === module) {
  // Test data
  const testData = {
    companyName: 'ABC Lighting Solutions',
    companyTagline: 'Illuminating Your World',
    companyAddress: 'ABC Lighting Solutions\n123 Main Street\nAnytown, ST 12345',
    estimateNumber: '00025',
    estimateDate: '12/15/2024',
    clientInfo: 'John Doe\nXYZ Corporation\n456 Business Ave\nBusiness City, BC 67890',
    jobName: 'Office Lighting Upgrade',
    items: [
      {
        description: 'LED Panel Lights 2x4',
        units: 20,
        cost: 45.00,
        amount: 900.00
      },
      {
        description: 'Installation Labor',
        units: 8,
        cost: 75.00,
        amount: 600.00
      },
      {
        description: 'Electrical Supplies',
        units: 1,
        cost: 150.00,
        amount: 150.00
      }
    ]
  };
  
  // Generate test estimate
  const generator = new EstimateGenerator();
  try {
    const outputPath = generator.generateEstimate(testData, 'test-estimate.html');
    console.log('Test estimate generated at:', outputPath);
  } catch (error) {
    console.error('Failed to generate test estimate:', error);
  }
}