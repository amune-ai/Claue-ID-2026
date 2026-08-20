function doGet(e) {
  var template = HtmlService.createTemplateFromFile("index");

  // These dropdown option lists are only used by <?!= ... ?> scriptlets in index.html,
  // so they only need to be computed here (once, per page load) instead of as
  // top-level statements that would otherwise re-run on every single google.script.run call.
  var options = getAllDropdownOptions();
  template.centerOptions = options.centerOptions;
  template.doctorNameOptions = options.doctorNameOptions;
  template.weekendCentersOptions = options.weekendCentersOptions;
  template.cancellationOfOptions = options.cancellationOfOptions;

  // Used by the "Reload" link (<?!= url ?>) shown on an invalid ID in index.html.
  template.url = ScriptApp.getService().getUrl();

  return template.evaluate()
  .setTitle("ID - Profile")
  .addMetaTag('viewport', 'width=device-width, initial-scale=1')
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
};

let ss = SpreadsheetApp.getActiveSpreadsheet();

// Reads Settings!C1:C3 in a single call, on demand, instead of 3 separate
// getValue() calls that used to run at load time on EVERY script execution.
function getEmailSettings(){
  // TEMP DIAGNOSTIC: split into two timed steps to find which half is slow.
  // Safe to delete once you've read the results in Logger.log - no behavior change.
  var t0 = Date.now();
  var settingsSheet = ss.getSheetByName('Settings');
  var tGetSheet = Date.now();

  var vals = settingsSheet.getRange('C1:C3').getValues();
  var tGetValues = Date.now();

  Logger.log(
    'getEmailSettings timing breakdown:\n' +
    '- ss.getSheetByName(Settings): ' + (tGetSheet - t0) + ' ms\n' +
    '- getRange(C1:C3).getValues(): ' + (tGetValues - tGetSheet) + ' ms\n' +
    '- Settings sheet dimensions: ' + settingsSheet.getMaxRows() + ' rows x ' + settingsSheet.getMaxColumns() + ' cols (last row with content: ' + settingsSheet.getLastRow() + ')'
  );

  return { targetEmail: vals[0][0], subjectEmail: vals[1][0], senderName: vals[2][0] };
}

function getUserInformation(){
  let sheet = ss.getSheetByName('Information');
  let data = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getDisplayValues();
  return data;
}

function getData(keyword){
  let info = getUserInformation(); // read the Information sheet only once
  let indexID = info.map(d => d[1]).indexOf(keyword);
  if(indexID > -1){
    let sheet = ss.getSheetByName('Data');
    let data = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getDisplayValues();
    let indexName = data.map(d => d[0]).indexOf(info[indexID][0]);
    return data[indexName];
  }else{
    return undefined;
  }
}

function saveData(obj){
  // TEMP DIAGNOSTIC: timing markers to find where Permission submission time goes.
  // Safe to delete once you've read the results in Logger.log - no behavior change.
  var t0 = Date.now();

  let sheet = ss.getSheetByName('Permission');
  var tGetSheet = Date.now();

  sheet.appendRow([
    new Date(),obj.name,obj.id,obj.centers,obj.date,obj.shift,obj.period
  ])
  var tAppendRow = Date.now();

  //add send email function start from here
  let emailSettings = getEmailSettings();
  var tEmailSettings = Date.now();

  let body =
        "<body>" +
          ""
          + "<br />" + 'PERMISSION '
          // + "<br />" + "You have a new message from "+objData.input1          
          + "<br />"
          +'<table class="mb-4 ">'

          +'<tr>'
          +'<td width="135" VALIGN=TOP>Name</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+ obj.name +'</td>'

          +'</tr>'
          +'<tr>'
          +'<td width="135" VALIGN=TOP>ID</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+obj.id+'</td>'

          +'</tr>'
          +'<tr>'
          +'<td>Centers</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.centers+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Date</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.date+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Shift</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.shift+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Period</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.period+'</td>'                 
          +'</tr>'          
          // +'<tr>'
          // +'<td style="font-weight: bold" >Output Google Sheets</td>'
          // +'<td>:</td>'
          // +'<td id="studentNumber"><a target="_blank" href='+url+'>Click here</a></td>'                  
          // +'</tr>'

          +'</table>'        
          + "<br /><br />" + '<i>Regards,</i>'
          + "<br />" + 'ADS Automation System' +                              
        "</body>";               
     
  var tBodyBuilt = Date.now();
  var tSendEmail, tQuota;

  try {
    MailApp.sendEmail(
                      emailSettings.targetEmail,
                      // objData.input2,
                      emailSettings.subjectEmail,
                      "",
                      {htmlBody: body, name: emailSettings.senderName}
                    );
    tSendEmail = Date.now();

    infoDailyQuota();
    tQuota = Date.now();
  } catch (e) {
    // Data is already saved above; don't fail the whole request just because the email couldn't be sent.
    Logger.log('saveData: email send failed: ' + e.toString());
  }
//add send email function end here

  Logger.log(
    'saveData timing breakdown:\n' +
    '- getSheetByName(Permission): ' + (tGetSheet - t0) + ' ms\n' +
    '- appendRow: ' + (tAppendRow - tGetSheet) + ' ms\n' +
    '- getEmailSettings: ' + (tEmailSettings - tAppendRow) + ' ms\n' +
    '- build email body (string concat, in-memory): ' + (tBodyBuilt - tEmailSettings) + ' ms\n' +
    '- MailApp.sendEmail: ' + (tSendEmail ? (tSendEmail - tBodyBuilt) + ' ms' : 'FAILED - see error above') + '\n' +
    '- infoDailyQuota (Mail quota check + Quota sheet write): ' + (tQuota && tSendEmail ? (tQuota - tSendEmail) + ' ms' : 'n/a') + '\n' +
    '- TOTAL: ' + (Date.now() - t0) + ' ms'
  );

  return true;
};

function saveData2(obj){
  let sheet = ss.getSheetByName('SickLeave');  
  sheet.appendRow([
    new Date(),obj.name2,obj.id2,obj.centers2,obj.date2,obj.question2,obj.numberOf2,obj.question2b
  ])

  //add send email function start from here
  let emailSettings = getEmailSettings();
  let body =
        "<body>" +
          ""
          + "<br />" + 'SICKLEAVE '
          // + "<br />" + "You have a new message from "+objData.input1          
          + "<br />"
          +'<table class="mb-4 ">'

          +'<tr>'
          +'<td width="135" VALIGN=TOP>Name</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+ obj.name2 +'</td>'

          +'</tr>'
          +'<tr>'
          +'<td width="135" VALIGN=TOP>ID</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+obj.id2+'</td>'

          +'</tr>'
          +'<tr>'
          +'<td>Centers</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.centers2+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Date</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.date2+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Sick Leave Type</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.question2+'</td>'                 
          +'</tr>' 

          +'</tr>'
          +'<tr>'
          +'<td>Number of Days</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.numberOf2+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Before/After Vacation ?</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.question2b+'</td>'                 
          +'</tr>'          

          +'</table>'       
          + "<br /><br />" + '<i>Regards,</i>'
          + "<br />" + 'ADS Automation System' +                              
        "</body>";               
     
  try {
    MailApp.sendEmail(
                      emailSettings.targetEmail,
                      // objData.input2,
                      emailSettings.subjectEmail,
                      "",
                      {htmlBody: body, name: emailSettings.senderName}
                    );
    infoDailyQuota();
  } catch (e) {
    Logger.log('saveData2: email send failed: ' + e.toString());
  }
//add send email function end here

  return true;
};

function saveData3(obj){
  // Only for Vacation (عرضي) which is limited
  if (obj.question3 === "Vacation (عرضي)") {
    let sheetVac = ss.getSheetByName('aratheVacation');
    let data = sheetVac.getRange("C2:C" + sheetVac.getLastRow()).getValues(); // Take all IDs from C2 down
    let count = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == obj.id3) { // Compare with the submitted ID
        count++;
      }
    }
    
    if (count >= 4) {
      return "LIMIT_REACHED"; // Return a special code to be captured on the client.
    }
  }
  
  let timestamp = new Date();
  let pdfID;
  // If it passes the check (or is not the عرضي type), continue saving the data.
  let sheet = ss.getSheetByName('Vacation');  

// Find the last row with actual data in column A (timestamp), ignoring formula-only rows
let lastRow = sheet.getRange("A:A").getValues().filter(String).length;

sheet.getRange(lastRow + 1, 1, 1, 9).setValues([[
  timestamp, obj.name3, obj.id3, obj.centers3, obj.question3, obj.fromDate, obj.to, obj.numberOf3, obj.question3b
]]);
  
  let templateId;
  let folderId;

  // === GENERATE PDF ===
  // Columns beyond I (Name, Civil ID, Nationality, ... - indices 48-54) are populated by
  // sheet formulas that look up obj.id3 in the Information sheet. Force those formulas to
  // recalculate now instead of blindly sleeping for a fixed 3 seconds.
  SpreadsheetApp.flush();

  console.log('obj.question3 result: ', obj.question3)
  // if(obj.question3 === "Vacation" || obj.question3 === "تمديد"){

  templateId = obj.question3 === "Vacation" || obj.question3 === "تمديد" ? '1xq161kF7zt5owlpsbdX3iTbJr9RHHKB0fDOrJABB3I4' : '1mdKOlv1ab7eB4es0dM-6qN_uz-Zr3m0yd9FH2Oxc7AY';

  folderId = obj.question3 === "Vacation" || obj.question3 === "تمديد" ? '1nn7JX9PIu8rMlpGLlenumR6UkBjnLdqt' : '1QJg2A67cEq7jvvSp3k4h2aC0PLduTxFn';

  // We already know exactly which row we just wrote (lastRow, 0-based) - no need to
  // re-read and scan the entire sheet by timestamp to find it again.
  let rowIndex = lastRow;
  {
    // Data found, now create PDF with replacement labels
    try {
      // Retrieve only the row we just wrote, not the whole sheet.
      let rowData = sheet.getRange(rowIndex + 1, 1, 1, sheet.getLastColumn()).getValues()[0];

      // Prepare mapping data to replace label in the template
      let replacements;
      if(obj.question3 === "Vacation" || obj.question3 === "تمديد"){
        replacements = {
          '{Timestamp}': rowData[0] ? formatDate(rowData[0], 'YYYY-MM-DD') : '',
          '{Name}': rowData[48] ? rowData[48].toString() : '',
          '{ID}': rowData[2] ? rowData[2].toString() : '',
          '{Civil ID}': rowData[49] ? rowData[49].toString() : '',   
          '{Nationality}': rowData[50] ? rowData[50].toString() : '',
          '{Job title}': rowData[51] ? rowData[51].toString() : '',       
          '{Mobile No.}': rowData[52] ? rowData[52].toString() : '',
          '{المركز}': rowData[53] ? rowData[53].toString() : '',   
          '{تاريخ التعيين بالوزارة}': rowData[54] ? formatDate(rowData[54], 'YYYY-MM-DD') : '',                       
          '{From Date}': rowData[5] ? formatDate(rowData[5], 'YYYY-MM-DD') : '',
          '{To Date}': rowData[6] ? formatDate(rowData[6], 'YYYY-MM-DD') : '',
          '{No.Days}': rowData[7] ? rowData[7] : ''
        };
      }else{
        console.log('rowData[27]: ',rowData[27])
        console.log('rowData[26]: ',rowData[26])
        replacements = {
          '{Day}': rowData[24] ? rowData[24] : '',
          '{From Date}': rowData[5] ? formatDate(rowData[5], 'YYYY-MM-DD') : '',          
          '{Name}': rowData[48] ? rowData[48].toString() : '',
          '{Civil ID}': rowData[49] ? rowData[49].toString() : '',          
          '{ID}': rowData[2] ? rowData[2].toString() : '',   
          '{Job title}': rowData[51] ? rowData[51].toString() : '',
          '{المركز}': rowData[53] ? rowData[53].toString() : '',                     
          '{ad}': rowData[27] ? rowData[27].toString() : '',      
          '{rd}': rowData[26] ? rowData[26].toString() : ''
        };        
      }  
      // } else {
      //   // Process AA and AB values directly from column T (index 19)
      //   let colT = rowData[19] !== "" && rowData[19] !== null ? Number(rowData[19]) : 0;
      //   let activeDays = Math.abs(Math.abs(colT + 1) - 4);   // AA column logic
      //   let remainingDays = Math.abs(colT + 1);               // AB column logic

      //   console.log('colT: ', colT);
      //   console.log('activeDays (AA): ', activeDays);
      //   console.log('remainingDays (AB): ', remainingDays);

      //   replacements = {
      //     '{Day}': rowData[24] ? rowData[24] : '',
      //     '{From Date}': rowData[5] ? formatDate(rowData[5], 'YYYY-MM-DD') : '',          
      //     '{Name}': rowData[48] ? rowData[48].toString() : '',
      //     '{Civil ID}': rowData[49] ? rowData[49].toString() : '',          
      //     '{ID}': rowData[2] ? rowData[2].toString() : '',   
      //     '{Job title}': rowData[51] ? rowData[51].toString() : '',
      //     '{المركز}': rowData[53] ? rowData[53].toString() : '',                     
      //     '{ad}': activeDays.toString(),      
      //     '{rd}': remainingDays.toString()
      //   };        
      // }      

      // Copy template Google Doc
      let template = DriveApp.getFileById(templateId);
      let copy = template.makeCopy(
        obj.name3 + ', ' + rowData[9] + ', ' + formatDate(rowData[5], 'YYYY-MM-DD'),
        DriveApp.getFolderById(folderId)
      );
      
      let doc = DocumentApp.openById(copy.getId());
      let body = doc.getBody();
      
      // Perform replacement for all labels in the document
      for (let label in replacements) {
        body.replaceText(label, replacements[label]);
      }
      
      doc.saveAndClose();
      
      // Convert document to PDF
      let pdfBlob = copy.getAs('application/pdf');
      let pdfFile = DriveApp.getFolderById(folderId).createFile(pdfBlob);
      
      // Delete unnecessary copies of documents (optional)
      DriveApp.getFileById(copy.getId()).setTrashed(true);
      
      // Get sharing link from PDF
      let pdfUrl = pdfFile.getUrl();
      pdfID = pdfFile.getId();

      // Update column BD (56th column, since A=1, B=2, ... BD=56) with PDF URL
      let lastCol = sheet.getLastColumn();
      if (lastCol < 56) {
        // Add a column if it doesn't exist until column BD
        sheet.insertColumns(lastCol + 1, 56 - lastCol);
      }
      
      // Update the cell in column BD (56) in the appropriate row (rowIndex + 1 because sheets are 1-based)
      sheet.getRange(rowIndex + 1, 56).setValue(pdfUrl);
      
    } catch (e) {
      Logger.log('Error generating PDF: ' + e.toString());
    }
  }
// }else{
//   //do nothing for now
// }

  // === Send Email (same as before) ===
  let emailSettings = getEmailSettings();
  let body =
        "<body>" +
          "<br />" + 'VACATION ' +
          "<br />" +
          '<table class="mb-4 ">'

          +'<tr><td width="135" VALIGN=TOP>Name</td><td width="20" VALIGN=TOP>:</td><td>'+ obj.name3 +'</td></tr>'
          +'<tr><td width="135" VALIGN=TOP>ID</td><td width="20" VALIGN=TOP>:</td><td>'+obj.id3+'</td></tr>'
          +'<tr><td>Centers</td><td>:</td><td>'+obj.centers3+'</td></tr>'
          +'<tr><td>Vacation Type</td><td>:</td><td>'+obj.question3+'</td></tr>'
          +'<tr><td>From Date</td><td>:</td><td>'+obj.fromDate+'</td></tr>'
          +'<tr><td>To</td><td>:</td><td>'+obj.to+'</td></tr>'
          +'<tr><td>Number of Days</td><td>:</td><td>'+obj.numberOf3+'</td></tr>'
          +'<tr><td>Weekend Duty ?</td><td>:</td><td>'+obj.question3b+'</td></tr>'

          +'</table>'      
          + "<br /><br />" + '<i>Regards,</i>'
          + "<br />" + 'ADS Automation System' +                              
        "</body>";               
     
  try {
    MailApp.sendEmail(
      emailSettings.targetEmail,
      emailSettings.subjectEmail,
      "",
      {htmlBody: body, name: emailSettings.senderName}
    );
    infoDailyQuota();
  } catch (e) {
    Logger.log('saveData3: email send failed: ' + e.toString());
  }

  return pdfID; // Return pdf id if saved successfully

}

function formatDate(dateValue, format = 'DD/MM/YYYY') {
  if (!dateValue) return '';
  
  let date;
  
  if (typeof dateValue === 'string') {
    if (dateValue.includes('/') || dateValue.includes('-')) {
      date = parseDateString(dateValue);
    } else {
      date = new Date(dateValue);
    }
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    date = new Date(dateValue);
  }
  
  if (isNaN(date.getTime())) {
    return dateValue.toString();
  }
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const shortYear = String(year).slice(-2);
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const monthName = monthNames[date.getMonth()];
  const monthShort = monthShortNames[date.getMonth()];
  
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'DD/MM/YY':
      return `${day}/${month}/${shortYear}`;
    case 'DD-MM-YY':
      return `${day}-${month}-${shortYear}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    case 'MMM DD, YYYY':
      return `${monthShort} ${day}, ${year}`;
    case 'MMMM DD, YYYY':
      return `${monthName} ${day}, ${year}`;
    case 'DD MMMM YYYY':
      return `${day} ${monthName} ${year}`;
    case 'DD MMM YYYY':
      return `${day} ${monthShort} ${year}`;
    default:
      return `${day}/${month}/${year}`;
  }
}
 
/**
 * Parse date strings in various formats
 */
function parseDateString(dateString) {
  dateString = dateString.trim();
  let date;
  
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(dateString)) {
    const parts = dateString.split(/[\/-]/);
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    date = new Date(year, month - 1, day);
  }
  else if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2}$/.test(dateString)) {
    const parts = dateString.split(/[\/-]/);
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    let year = parseInt(parts[2]);
    year = year < 50 ? 2000 + year : 1900 + year;
    date = new Date(year, month - 1, day);
  }
  else if (/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(dateString)) {
    const parts = dateString.split(/[\/-]/);
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    date = new Date(year, month - 1, day);
  }
  else if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(dateString)) {
    date = new Date(dateString);
  }
  else {
    date = new Date(dateString);
  }
  
  return date;
}

function saveData4(obj){
  let sheet = ss.getSheetByName('DailyDutyChange');  
  sheet.appendRow([
    new Date(),obj.name4,obj.id4,obj.centers4,obj.fromDate4,obj.to4,obj.nameOfColleague
  ])

  //add send email function start from here
  let emailSettings = getEmailSettings();
  let body =
        "<body>" +
          ""
          + "<br />" + 'DAILY DUTY CHANGE '
          // + "<br />" + "You have a new message from "+objData.input1          
          + "<br />"
          +'<table class="mb-4 ">'

          +'<tr>'
          +'<td width="135" VALIGN=TOP>Name</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+ obj.name4 +'</td>'

          +'</tr>'
          +'<tr>'
          +'<td width="135" VALIGN=TOP>ID</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+obj.id4+'</td>'

          +'</tr>'
          +'<tr>'
          +'<td>Centers</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.centers4+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>From Date</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.fromDate4+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>To</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.to4+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Name of Colleague</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.nameOfColleague+'</td>'                 
          +'</tr>'
         
          // +'<tr>'
          // +'<td style="font-weight: bold" >Output Google Sheets</td>'
          // +'<td>:</td>'
          // +'<td id="studentNumber"><a target="_blank" href='+url+'>Click here</a></td>'                  
          // +'</tr>'

          +'</table>'      
          + "<br /><br />" + '<i>Regards,</i>'
          + "<br />" + 'ADS Automation System' +                              
        "</body>";               
     
  try {
    MailApp.sendEmail(
                      emailSettings.targetEmail,
                      // objData.input2,
                      emailSettings.subjectEmail,
                      "",
                      {htmlBody: body, name: emailSettings.senderName}
                    );
    infoDailyQuota();
  } catch (e) {
    Logger.log('saveData4: email send failed: ' + e.toString());
  }
//add send email function end here

  return true;
};

function saveData5(obj){
  let sheet = ss.getSheetByName('WeekendDutyChange');  
  sheet.appendRow([
    new Date(),obj.name5,obj.id5,obj.centers5,obj.date5,obj.nameOfColleague5,obj.otherColleague,obj.date5b
  ])

  //add send email function start from here
  let emailSettings = getEmailSettings();
  let body =
        "<body>" +
          ""
          + "<br />" + 'WEEKEND DUTY CHANGE '
          // + "<br />" + "You have a new message from "+objData.input1          
          + "<br />"
          +'<table class="mb-4 ">'

          +'<tr>'
          +'<td width="135" VALIGN=TOP>Name</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+ obj.name5 +'</td>'

          +'</tr>'
          +'<tr>'
          +'<td width="135" VALIGN=TOP>ID</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+obj.id5+'</td>'

          +'</tr>'
          +'<tr>'
          +'<td>Centers</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.centers5+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Date</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.date5+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Name of Colleague</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.nameOfColleague5+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Other Colleague Center</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.otherColleague+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Date</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.date5b+'</td>'                 
          +'</tr>'

          // +'<tr>'
          // +'<td style="font-weight: bold" >Output Google Sheets</td>'
          // +'<td>:</td>'
          // +'<td id="studentNumber"><a target="_blank" href='+url+'>Click here</a></td>'                  
          // +'</tr>'

          +'</table>'        
          + "<br /><br />" + '<i>Regards,</i>'
          + "<br />" + 'ADS Automation System' +                              
        "</body>";               
     
  try {
    MailApp.sendEmail(
                      emailSettings.targetEmail,
                      // objData.input2,
                      emailSettings.subjectEmail,
                      "",
                      {htmlBody: body, name: emailSettings.senderName}
                    );
    infoDailyQuota();
  } catch (e) {
    Logger.log('saveData5: email send failed: ' + e.toString());
  }
//add send email function end here

  return true;
};

function saveData6(obj){
  let sheet = ss.getSheetByName('Cancellation');  
  sheet.appendRow([
    new Date(),obj.name6,obj.id6,obj.centers6,obj.cancellationOf,obj.date6
  ])

  //add send email function start from here
  let emailSettings = getEmailSettings();
  let body =
        "<body>" +
          ""
          + "<br />" + 'CANCELLATION '
          // + "<br />" + "You have a new message from "+objData.input1          
          + "<br />"
          +'<table class="mb-4 ">'

          +'<tr>'
          +'<td width="135" VALIGN=TOP>Name</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+ obj.name6 +'</td>'

          +'</tr>'
          +'<tr>'
          +'<td width="135" VALIGN=TOP>ID</td>'
          +'<td width="20" VALIGN=TOP>:</td>'
          +'<td id="id">'+obj.id6+'</td>'

          +'</tr>'
          +'<tr>'
          +'<td>Centers</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.centers6+'</td>'                 
          +'</tr>'

          +'</tr>'
          +'<tr>'
          +'<td>Cancellation of</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.cancellationOf+'</td>'                 
          +'</tr>'
          +'</tr>'

          +'<tr>'
          +'<td>Date</td>'
          +'<td>:</td>'
          +'<td id="id">'+obj.date6+'</td>'                 
          +'</tr>'

          +'</table>'        
          + "<br /><br />" + '<i>Regards,</i>'
          + "<br />" + 'ADS Automation System' +                              
        "</body>";               
     
  try {
    MailApp.sendEmail(
                      emailSettings.targetEmail,
                      // objData.input2,
                      emailSettings.subjectEmail,
                      "",
                      {htmlBody: body, name: emailSettings.senderName}
                    );
    infoDailyQuota();
  } catch (e) {
    Logger.log('saveData6: email send failed: ' + e.toString());
  }
//add send email function end here

  return true;
};

function getOptionsData(){
  var sheetName = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Set Dropdown");
  var data = sheetName.getRange(2, 1, sheetName.getLastRow()-1, sheetName.getLastColumn()).getValues();
  return data;
}

// Reads "Set Dropdown" ONCE and derives all 4 option lists from it, instead of the
// previous 4 separate top-level getOptionsData() calls (4x the sheet reads, and run
// on every script execution instead of only when doGet renders the page).
function getAllDropdownOptions(){
  var data = getOptionsData();
  var toOptions = function(colIndex){
    return data.filter(function(d){ return d[colIndex] !== ""; })
               .map(function(d){ return '<option>' + d[colIndex] + '</option>'; }).join("");
  };
  return {
    centerOptions: toOptions(0),
    doctorNameOptions: toOptions(1),
    weekendCentersOptions: toOptions(2),
    cancellationOfOptions: toOptions(3)
  };
}

//Additional function to send email
function infoDailyQuota(){
  let quota = MailApp.getRemainingDailyQuota();
  ss.getSheetByName('Quota').getRange('C1').setValue(quota);
  return true;
}

function getApprovalProgress(id) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CombinedApprovalsF');
  var data = sheet.getDataRange().getDisplayValues();
  var result = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === id) {
      result.push(data[i]);
    }
  }
  return JSON.stringify(result);
};

// Function Weekend Duty Approval Request START here
function checkApprovalInformation(searchText){
  let sheetName = ss.getSheetByName('WeekendDutyChangeApprovalsF');
  let data = sheetName.getRange(2, 1, sheetName.getLastRow()-1, sheetName.getLastColumn()).getValues();

  //In this code below d[4] == "" mean we filter the data row in sheet WeekendDutyChangeApprovalsF if column 4 which is Status user 2 approval is blank. So we only bring the row that not approved yet for the current user login
  //In this code below .map(d => d[3]) mean from the filtered data row, we only take one column which is column 4 (index 3), which is "Approval Reports".
  let nameInDatabase = data.filter(d => d[5] == "").map(d => d[4]);
  // searchText = "Abdulrahman Almaraqi";

let index = nameInDatabase.findIndex(element => {

  //This code below is use to get text after text "with: "
  //in column 4 which is "Approval Reports", we try to find each text that included text "with: "
  let withIndex = element.indexOf("with : ");

  //if (withIndex !== -1) { mean we only process text that have "with: " in it (column 4).
  if (withIndex !== -1) {
    /*
  withIndex is the index position of the text "with: " in the element variable.
  + 6 is added to the starting position after the "with: " character. Since the length of the text "with: " is 5 characters, plus 1 space character after it, we add 6 to start from the character after the space.
  So, textAfterWith is a chunk of text starting from the character after "with: ". For example, if the element is "Abdulrahman Almaraqi in Adan Specialty PM on 27/02/2023, wants to change Weekend Duty with : Abdallah Alrowaih in Adan Specialty AM on 27/02/2023", then the textAfterWith will be "Abdallah Alrowaih in Adan Specialty AM on 02/27/2023". This final text then we will use as an element to match with the name of current login user.
  */
    let textAfterWith = element.slice(withIndex + 6);
    // Checks if searchText is found after "with: "
    return textAfterWith.includes(searchText);
  }
  return false;
});
  
  /*This code below if (index !== -1) { is related to the "index" variable above, which is after the final text tries to match with the name of the current logged in user. If it matches, then produces an index number of 0 or 1 or 2 or so on, and if it doesn't match it will produce the number -1.
  */
  if (index !== -1) {
    console.log(`Text '${searchText}' found in index-${index}`);
    console.log(nameInDatabase[index]);
    return [nameInDatabase[index],index]
  } else {
    console.log(`Text '${searchText}' not found in array.`);
    return false;
  }
}

function approvedApproval(name){
  let sheetName = ss.getSheetByName('WeekendDutyChange');
  let data = sheetName.getRange(2, 1, sheetName.getLastRow()-1, sheetName.getLastColumn()).getValues();

  /*(d[6] + d[10]).toLowerCase() mean we try to combine column 7 (index 6) which is "Name of Colleague" and column 11 (index 10) which is "Status user 2 approval", so the final combination result will be like this for example "Abdulrahman AlmaraqiApproved" (if user has approved) and only it name like "Abdallah Alamer" (if not approved yet). And we will use this final combination to matched with current login user name
  */
  let nameInDatabase = data.map(d => (d[5] + d[10]).toLowerCase());
  let nameIdx = nameInDatabase.indexOf(name.toLowerCase())

  /*pareseInt in JavaScript is used to convert text or string to number.
  nameIdx is a result that come from previous process that we get from matched current login user with combination of Name Of Colleague with Status user 2 aproval.
  We add +2 is because even if user match with first data row, it will only give us index 0, buy since the data start it from second row, then we have to add it with 2 so the data form code.gs will replaced/updated data start at least from column 2.
  11 mean the column that we want to updated is column 11 which is "Status user 2 approval".
  */ 
  sheetName.getRange(parseInt(nameIdx)+2,11).setValue('Approved by Colleague');
};

function approvedApprovalNo(name){
  let sheetName = ss.getSheetByName('WeekendDutyChange');
  let data = sheetName.getRange(2, 1, sheetName.getLastRow()-1, sheetName.getLastColumn()).getValues();

  /*(d[6] + d[10]).toLowerCase() mean we try to combine column 7 (index 6) which is "Name of Colleague" and column 11 (index 10) which is "Status user 2 approval", so the final combination result will be like this for example "Abdulrahman AlmaraqiApproved" (if user has approved) and only it name like "Abdallah Alamer" (if not approved yet). And we will use this final combination to matched with current login user name
  */
  let nameInDatabase = data.map(d => (d[5] + d[10]).toLowerCase());
  let nameIdx = nameInDatabase.indexOf(name.toLowerCase())

  /*pareseInt in JavaScript is used to convert text or string to number.
  nameIdx is a result that come from previous process that we get from matched current login user with combination of Name Of Colleague with Status user 2 aproval.
  We add +2 is because even if user match with first data row, it will only give us index 0, buy since the data start it from second row, then we have to add it with 2 so the data form code.gs will replaced/updated data start at least from column 2.
  11 mean the column that we want to updated is column 11 which is "Status user 2 approval".
  */
  sheetName.getRange(parseInt(nameIdx)+2,11).setValue('Not Approved by Colleague');
}
// Function Weekend Duty Approval Request END here

function getMonthNameAndYear() {
  var now = new Date();
  var monthName = Utilities.formatDate(now, "GMT", "MMMM");
  var year = Utilities.formatDate(now, "GMT", "yyyy");
  return monthName + " " + year;
};


//Function for tick table Start

/* PROCESS FORM */
function getTableData(objInput){
    var sheet = ss.getSheetByName(objInput.input1);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    if(objInput.input1 == "Permission"){
      // Bounded to lastRow instead of open-ended 'A2:P', which used to read down to the
      // sheet's full row count regardless of how many rows actually contain data.
      var data = sheet.getRange(2, 1, lastRow - 1, 16).getDisplayValues().filter(d => d[0] !== "").map(d => [d[0],d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8],d[9],d[15]]);

      //use function filterDuplicateRows(dt) to make dataFiltered to be unique
      // let dataFiltered = filterDuplicateRows(data.filter(d => d[3] == dataPharmacy[idx]))
      let dataFiltered = filterDuplicateRows(data.filter(d => d[2] == objInput.input2))
      return dataFiltered.reverse(); //use reverse() method to sort the data from newest to oldest
    }else if(objInput.input1 == "SickLeave"){
      var data = sheet.getRange(2, 1, lastRow - 1, 16).getDisplayValues().filter(d => d[0] !== "").map(d => [d[0],d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8],d[9],d[10],d[15]]);

      //use function filterDuplicateRows(dt) to make dataFiltered to be unique
      // let dataFiltered = filterDuplicateRows(data.filter(d => d[3] == dataPharmacy[idx]))
      let dataFiltered = filterDuplicateRows(data.filter(d => d[2] == objInput.input2))
      return dataFiltered.reverse(); //use reverse() method to sort the data from newest to oldest
    }else if(objInput.input1 == "Vacation"){
      var data = sheet.getRange(2, 1, lastRow - 1, 21).getDisplayValues().filter(d => d[0] !== "").map(d => [d[0],d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8],d[9],d[10],d[11],d[12],d[20]]);

      //use function filterDuplicateRows(dt) to make dataFiltered to be unique
      // let dataFiltered = filterDuplicateRows(data.filter(d => d[3] == dataPharmacy[idx]))
      let dataFiltered = filterDuplicateRows(data.filter(d => d[2] == objInput.input2))
      return dataFiltered.reverse(); //use reverse() method to sort the data from newest to oldest
    }

};

function filterDuplicateRows(dt) {
  
  // Retrieve data from parameters
  var data = dt;//sheet.getDataRange().getValues();
  
  // Initialize an array to store unique rows
  var uniqueRows = [];
  
  // Initialize the object to track unique combinations of the second and ninth columns
  var uniqueCombination = {};
  
  // Iterate through each row of data
  for (var i = 0; i < data.length; i++) {
    var currentRow = data[i];
    
    // Create unique keys from the second and sixth columns
    var key = currentRow[1] + '|' + currentRow[2] + '|' + currentRow[3] + '|' + currentRow[4] + '|' + currentRow[5] + '|' + currentRow[6];
    
    // Checks whether the key already exists in the uniqueCombination object
    if (!uniqueCombination[key]) {
      // Otherwise, adds the row to the array uniqueRows
      uniqueRows.push(currentRow);
      
      // Set the value true for the key in the object uniqueCombination
      uniqueCombination[key] = true;
    }
  }
  
  return uniqueRows;
}

// Reads only column A (the ID column) of a sheet instead of the whole sheet, just to
// find the row position of a given value. Returns [] for an empty/1-row sheet.
function getColumnAValues(sheet){
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  return sheet.getRange(1, 1, lastRow, 1).getDisplayValues().map(function(r){ return r[0]; });
}

function setStatus(category, id, value1, value2, value3, value4, value5, value6, value7, value8, value9, value10) {
  let sheetName = category == "Permission" ? "Cancellation Permission" :
                  category == "SickLeave" ? "Cancellation SickLeave" :
                  "CancellationVacation";

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var index = getColumnAValues(sheet); // only reads column A, not the whole sheet
  var position = index.indexOf(value1); // Find the position of value1 in that column

  if (position == -1) {
    // If not found, add a new row
    sheet.appendRow([value1, value2, value3, value4, value5, value6, value7, value8, value9, value10]);

    //function to set status "Submitted" in current tab start here
    var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(category);
    var index2 = getColumnAValues(sheet2);
    var position2 = index2.indexOf(value1); // Find the position of value1 in that column
    if (position2 > -1) {
      // set status "Submitted" in col P (16)
      sheet2.getRange(position2+1,16).setValue("Submitted")
    }
    //function to set status "Submitted" in current tab end here

    return "Data Submitted";

  } else {
    // If found, delete the corresponding row
    sheet.deleteRow(position + 1); // Add 1 because array index starts at 0, but spreadsheet row index starts at 1

    //function to delete status "Submitted" in current tab start here
    var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(category);
    var index2 = getColumnAValues(sheet2);
    var position2 = index2.indexOf(value1); // Find the position of value1 in that column
    if (position2 > -1) {
      // clear status "Submitted" in col P (16)
      sheet2.getRange(position2+1,16).clear();
    }
    //function to set status "Submitted" in current tab end here

    return "Data Deleted";
  };

};

function setStatus2(category, id, value1, value2, value3, value4, value5, value6, value7, value8, value9, value10, value11) {
  let sheetName = category == "Permission" ? "Cancellation Permission" :
                  category == "SickLeave" ? "Cancellation SickLeave" :
                  "CancellationVacation";

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var index = getColumnAValues(sheet); // only reads column A, not the whole sheet
  var position = index.indexOf(value1); // Find the position of value1 in that column

  if (position == -1) {
    // If not found, add a new row
    sheet.appendRow([value1, value2, value3, value4, value5, value6, value7, value8, value9, value10, value11]);

    //function to set status "Submitted" in current tab start here
    var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(category);
    var index2 = getColumnAValues(sheet2);
    var position2 = index2.indexOf(value1); // Find the position of value1 in that column
    if (position2 > -1) {
      // set status "Submitted" in col P (16)
      sheet2.getRange(position2+1,16).setValue("Submitted")
    }
    //function to set status "Submitted" in current tab end here

    return "Data Submitted";
  } else {
    // If found, delete the corresponding row
    sheet.deleteRow(position + 1); // Add 1 because array index starts at 0, but spreadsheet row index starts at 1

    //function to delete status "Submitted" in current tab start here
    var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(category);
    var index2 = getColumnAValues(sheet2);
    var position2 = index2.indexOf(value1); // Find the position of value1 in that column
    if (position2 > -1) {
      // clear status "Submitted" in col P (16)
      sheet2.getRange(position2+1,16).clear();
    }
    //function to set status "Submitted" in current tab end here

    return "Data Deleted";
  };
};

function setStatus3(category, id, value1, value2, value3, value4, value5, value6, value7, value8, value9, value10, value11, value12, value13) {
  let sheetName = category == "Permission" ? "Cancellation Permission" :
                  category == "SickLeave" ? "Cancellation SickLeave" :
                  "CancellationVacation";

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var index = getColumnAValues(sheet); // only reads column A, not the whole sheet
  var position = index.indexOf(value1); // Find the position of value1 in that column

  if (position == -1) {
    // If not found, add a new row
    sheet.appendRow([value1, value2, value3, value4, value5, value6, value7, value8, value9, value10, value11, value12, value13]);

    //function to set status "Submitted" in current tab start here
    var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(category);
    var index2 = getColumnAValues(sheet2);
    var position2 = index2.indexOf(value1); // Find the position of value1 in that column
    if (position2 > -1) {
      // set status "Submitted" in col U (21) - Vacation sheet's status column, unlike
      // setStatus/setStatus2 which use col P (16) for Permission/SickLeave.
      sheet2.getRange(position2+1,21).setValue("Submitted")
    }
    //function to set status "Submitted" in current tab end here

    return "Data Submitted";
  } else {
    // If found, delete the corresponding row
    sheet.deleteRow(position + 1); // Add 1 because array index starts at 0, but spreadsheet row index starts at 1

    //function to delete status "Submitted" in current tab start here
    var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(category);
    var index2 = getColumnAValues(sheet2);
    var position2 = index2.indexOf(value1); // Find the position of value1 in that column
    if (position2 > -1) {
      // clear status "Submitted" in col U (21)
      sheet2.getRange(position2+1,21).clear();
    }
    //function to set status "Submitted" in current tab end here

    return "Data Deleted";
  };
}

//Function for tick table End

function test(){
  let category = "Permission"
  let sheetName = category == "Permission" ? "Cancellation Permission" : category == "SickLeave" ? "Cancellation SickLeave" : "Cancellation Vacation";
  console.log(sheetName)
}

function syncDataFast() {
  const destSS = SpreadsheetApp.getActiveSpreadsheet();

  // 1. CONFIGURATION: List your sources and destinations here
  const syncJobs = [
    {
      sourceId: "1OWT7kh-yUzO_gn9qLmTjdOYZ9DKUDf3-HiyFwSFpTFE", // أسماء الاطباء
      sourceTab: "DocName", 
      sourceRange: "A1:Q", 
      destTab: "ImportRanges", 
      destRow: 1, 
      destCol: 1
    },
    {
      sourceId: "19gscNMJ-Rubq3UQAmefDdsQ0maUJqi6jlsH-9EtugLE", // Teamleader
      sourceTab: "Registration", 
      sourceRange: "A1:H", 
      destTab: "ImportRanges", 
      destRow: 1, 
      destCol: 19 // This puts it in Column N
    },
    {
      sourceId: "1rGV4lH5ZzUx4WcsTZPBIuVOkaJi32krRFrUg8k_EMl8", // Khafarat Normal
      sourceTab: "StatusTrnsf", 
      sourceRange: "A1:Y", 
      destTab: "ImportRanges", 
      destRow: 1, 
      destCol: 28 // This puts it in Column W
    },
    {
      sourceId: "1rGV4lH5ZzUx4WcsTZPBIuVOkaJi32krRFrUg8k_EMl8", // Khafarat Adan Hospital
      sourceTab: "StatusTrnsf", 
      sourceRange: "AA1:AY",  
      destTab: "ImportRanges", 
      destRow: 1, 
      destCol: 54 // This puts it in Column AW
    },
    {
      sourceId: "1-FwwEOhTJQmlLm6_-T1KpIGJepsGBshN1biAXMUatFI", // Centers
      sourceTab: "CentersName", 
      sourceRange: "A1:A", 
      destTab: "ImportRanges", 
      destRow: 1, 
      destCol: 80 // This puts it in Column BW
    },
    {
      sourceId: "1rGV4lH5ZzUx4WcsTZPBIuVOkaJi32krRFrUg8k_EMl8",   // WeekendDuty Change  M:N Exicutions
      sourceTab: "WeekendDutyChange", 
      sourceRange: "M1:N", 
      destTab: "ImportRanges", 
      destRow: 1, 
      destCol: 82 // This puts it in Column BY
    },
    {
      sourceId: "1Q0E90y1l90KXye8vt0EZjr2hEPeKx-pRdb2gJlXspPU",   // Upload SickLeave  A:F Exicutions
      sourceTab: "UploadedData", 
      sourceRange: "A1:F", 
      destTab: "ImportRanges", 
      destRow: 1, 
      destCol: 85 // This puts it in Column CG
    },
    {
      sourceId: "1Q0E90y1l90KXye8vt0EZjr2hEPeKx-pRdb2gJlXspPU",   // Upload SickLeave  A:F Exicutions
      sourceTab: "UploadedVacations", 
      sourceRange: "A1:F", 
      destTab: "ImportRanges", 
      destRow: 1, 
      destCol: 92 // This puts it in Column CN
    },
    {
      sourceId: "1Q0E90y1l90KXye8vt0EZjr2hEPeKx-pRdb2gJlXspPU",   // Upload اقرارعودة  A:F Exicutions
      sourceTab: "UploadedEqrarawdah",
      sourceRange: "A1:F",
      destTab: "ImportRanges",
      destRow: 1,
      destCol: 99 // This puts it in Column CU
    }
  ];

  // 2. EXECUTION: Loop through each job defined above
  syncJobs.forEach(function(job) {
    try {
      // Connect to Source
      const sourceSS = SpreadsheetApp.openById(job.sourceId);
      const sourceSheet = sourceSS.getSheetByName(job.sourceTab);
      const data = sourceSheet.getRange(job.sourceRange).getValues();

      // Connect to Destination
      const destSheet = destSS.getSheetByName(job.destTab);
      
      // Clear ONLY the area where data is about to be pasted
      // This prevents old data from staying behind if the new pull is smaller
      destSheet.getRange(job.destRow, job.destCol, destSheet.getLastRow() || 1, data[0].length).clearContent();

      // Paste the fresh data
      destSheet.getRange(job.destRow, job.destCol, data.length, data[0].length).setValues(data);
      
      console.log(`Success: ${job.sourceTab} synced to ${job.destTab}`);
      
    } catch (e) {
      console.log(`Error syncing ${job.sourceTab}: ${e.message}`);
    }
  });

  console.log("Global Sync Finished: " + new Date());
}

// //Function to check and display Vacations PDF
// function getVacationsPdf(userId) {
//   var sheet = ss.getSheetByName('Vacation');
//   var lastRow = sheet.getLastRow();

//   if (lastRow < 2) return [];

//   // Get columns C (index 2), K (index 10), M (index 12), BD (index 55)
//   var dataC = sheet.getRange(2, 3, lastRow - 1, 1).getValues();  // Column C - ID
//   var dataK = sheet.getRange(2, 11, lastRow - 1, 1).getValues(); // Column K - Request details
//   var dataM = sheet.getRange(2, 13, lastRow - 1, 1).getValues(); // Column M - Approval status
//   var dataBD = sheet.getRange(2, 56, lastRow - 1, 1).getValues(); // Column BD - PDF URL

//   var result = [];

//   for (var i = 0; i < dataC.length; i++) {
//     var rowId = dataC[i][0] ? dataC[i][0].toString().trim() : '';
//     var approvalStatus = dataM[i][0] ? dataM[i][0].toString().trim() : '';
//     var colK = dataK[i][0] ? dataK[i][0].toString().trim() : '';
//     var pdfUrl = dataBD[i][0] ? dataBD[i][0].toString().trim() : '';

//     // Match user ID and check approval status
//     if (rowId === userId.toString().trim() && approvalStatus === 'Approved by Admin' && pdfUrl !== '') {
//       result.push({
//         colK: colK,
//         pdfUrl: pdfUrl
//       });
//     }
//   }

//   return result;
// }
function getVacationsPdf(userId) {
  var sheet = ss.getSheetByName('Vacation');
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  var dataA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var dataC = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  var dataK = sheet.getRange(2, 11, lastRow - 1, 1).getValues();
  var dataM = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
  var dataBD = sheet.getRange(2, 56, lastRow - 1, 1).getValues();

  var result = [];

  for (var i = 0; i < dataC.length; i++) {
    var rowId = dataC[i][0] ? dataC[i][0].toString().trim() : '';
    var approvalStatus = dataM[i][0] ? dataM[i][0].toString().trim() : '';
    var colK = dataK[i][0] ? dataK[i][0].toString().trim() : '';
    var pdfUrl = dataBD[i][0] ? dataBD[i][0].toString().trim() : '';
    var timestamp = dataA[i][0] ? new Date(dataA[i][0]) : new Date(0);

    // DEBUG: log all lines whose IDs match
    if (rowId === userId.toString().trim()) {
      console.log('Row ' + (i+2) + ' | ID: ' + rowId + ' | approvalStatus: [' + approvalStatus + '] | pdfUrl: ' + pdfUrl);
    }

    if (rowId === userId.toString().trim() && approvalStatus === 'Approved by Admin' && pdfUrl !== '') {
      result.push({
        timestamp: timestamp.getTime(),
        colK: colK,
        pdfUrl: pdfUrl
      });
    }
  }

  result.sort(function(a, b) {
    return b.timestamp - a.timestamp;
  });

  return result;
}

// Returns this user's sick leave summaries from SickLeave!AA2:AA (col C = ID), for the
// "Upload your Sickleave PDF" dropdown.
function getSickLeaveSummaries(userId) {
  var sheet = ss.getSheetByName('SickLeave');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var dataC = sheet.getRange(2, 3, lastRow - 1, 1).getValues();   // ID
  var dataI = sheet.getRange(2, 9, lastRow - 1, 1).getValues();   // Code (col I)
  var dataAA = sheet.getRange(2, 27, lastRow - 1, 1).getValues(); // Summary (col AA)

  var result = [];
  for (var i = 0; i < dataC.length; i++) {
    var rowId = dataC[i][0] ? dataC[i][0].toString().trim() : '';
    var summary = dataAA[i][0] ? dataAA[i][0].toString().trim() : '';
    var code = dataI[i][0] ? dataI[i][0].toString().trim() : '';
    if (rowId === userId.toString().trim() && summary !== '') {
      result.push({summary: summary, code: code});
    }
  }
  return result;
}

// Uploads a sick leave PDF to Drive and logs it to the external "UploadedData" sheet,
// same cross-spreadsheet pattern as the chatbot's logChatToExternalSheet().
//
// Re-uploading with a code already present in destSheet's Code column (E) overwrites
// that row instead of appending a duplicate.
function upsertUploadRow(destSheet, code, rowValues) {
  var lastRow = destSheet.getLastRow();
  if (lastRow >= 2) {
    var codes = destSheet.getRange(2, 5, lastRow - 1, 1).getValues(); // Code column
    for (var i = 0; i < codes.length; i++) {
      if (codes[i][0] && codes[i][0].toString().trim() === code.toString().trim()) {
        destSheet.getRange(i + 2, 1, 1, rowValues.length).setValues([rowValues]);
        return;
      }
    }
  }
  destSheet.appendRow(rowValues);
}

function uploadSickLeavePdf(base64Data, fileName, name, id, summary, code) {
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'application/pdf', fileName);
  var file = DriveApp.getFolderById('1hmDFt8N5pHcN_12DYjJjc6iSRe03HIDT').createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var destSheet = SpreadsheetApp.openById('1Q0E90y1l90KXye8vt0EZjr2hEPeKx-pRdb2gJlXspPU').getSheetByName('UploadedData');
  upsertUploadRow(destSheet, code, [new Date(), name, id, summary, code, file.getUrl()]);

  return file.getUrl();
}

// Vacation-upload sibling of getSickLeaveSummaries/uploadSickLeavePdf: dropdown from
// Vacation!BS, Code from Vacation!J, saved to a different Drive folder + sheet tab.
function getVacationUploadSummaries(userId) {
  var sheet = ss.getSheetByName('Vacation');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var dataC = sheet.getRange(2, 3, lastRow - 1, 1).getValues();    // ID
  var dataJ = sheet.getRange(2, 10, lastRow - 1, 1).getValues();   // Code (col J)
  var dataBS = sheet.getRange(2, 71, lastRow - 1, 1).getValues();  // Summary (col BS)

  var result = [];
  for (var i = 0; i < dataC.length; i++) {
    var rowId = dataC[i][0] ? dataC[i][0].toString().trim() : '';
    var summary = dataBS[i][0] ? dataBS[i][0].toString().trim() : '';
    var code = dataJ[i][0] ? dataJ[i][0].toString().trim() : '';
    if (rowId === userId.toString().trim() && summary !== '') {
      result.push({summary: summary, code: code});
    }
  }
  return result;
}

function uploadVacationPdf(base64Data, fileName, name, id, summary, code) {
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'application/pdf', fileName);
  var file = DriveApp.getFolderById('1tH-pHaE56TqdZnoeo0U70QF2SGeXmduC').createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var destSheet = SpreadsheetApp.openById('1Q0E90y1l90KXye8vt0EZjr2hEPeKx-pRdb2gJlXspPU').getSheetByName('UploadedVacations');
  upsertUploadRow(destSheet, code, [new Date(), name, id, summary, code, file.getUrl()]);

  return file.getUrl();
}

// اقرار عودة upload: same dropdown source as uploadVacationPdf (Vacation!BS/J via
// getVacationUploadSummaries), different Drive folder + destination tab.
function uploadEqrarAwdahPdf(base64Data, fileName, name, id, summary, code) {
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'application/pdf', fileName);
  var file = DriveApp.getFolderById('1jxs7InR6x0BLApf6OiDOzTattVbP-AW3').createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var destSheet = SpreadsheetApp.openById('1Q0E90y1l90KXye8vt0EZjr2hEPeKx-pRdb2gJlXspPU').getSheetByName('UploadedEqrarawdah');
  upsertUploadRow(destSheet, code, [new Date(), name, id, summary, code, file.getUrl()]);

  return file.getUrl();
}

//Function to generate PDF from Sheet
// === MENU ===
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PDF Tools')
    .addItem('Generate PDF', 'showGeneratePdfDialog')
    .addToUi();
}

function showGeneratePdfDialog() {
  var html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      button { margin: 8px 4px; padding: 10px 20px; cursor: pointer; border: none; border-radius: 4px; font-size: 14px; }
      .btn-all { background: purple; color: white; width: 100%; }
      .btn-range { background: blue; color: white; width: 100%; }
      input { width: 100%; padding: 8px; margin: 8px 0; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px; }
      #rangeSection { display: none; margin-top: 10px; }
      #status { margin-top: 12px; font-size: 13px; color: #555; }
    </style>

    <h3>Generate PDF</h3>
    <p style="font-size:13px; color:#666;">
      Generates PDF for rows where column M = "Approved by Admin" and column BD is empty.
    </p>

    <button class="btn-all" onclick="submitAll()">1. Generate All Rows</button>
    <button class="btn-range" onclick="showRange()">2. Generate Specific Row(s)</button>

    <div id="rangeSection">
      <label style="font-size:13px;">Enter row number(s):</label>
      <input type="text" id="rangeInput" placeholder="e.g: 1000 or 5-10 or 2,3,10,20">
      <button class="btn-range" onclick="submitRange()">Generate</button>
      <p style="font-size:11px; color:#888;">
        • Single row: <b>1000</b><br>
        • Range: <b>5-10</b><br>
        • Multiple: <b>2,3,10,20</b>
      </p>
    </div>

    <div id="status"></div>

    <script>
      function showRange() {
        document.getElementById('rangeSection').style.display = 'block';
      }

      function submitAll() {
        document.getElementById('status').innerText = 'Processing... please wait.';
        google.script.run
          .withSuccessHandler(function(msg) {
            document.getElementById('status').innerText = msg;
          })
          .withFailureHandler(function(err) {
            document.getElementById('status').innerText = 'Error: ' + err.message;
          })
          .generatePdfAll();
      }

      function submitRange() {
        var input = document.getElementById('rangeInput').value.trim();
        if (!input) {
          document.getElementById('status').innerText = 'Please enter row number(s).';
          return;
        }
        document.getElementById('status').innerText = 'Processing... please wait.';
        google.script.run
          .withSuccessHandler(function(msg) {
            document.getElementById('status').innerText = msg;
          })
          .withFailureHandler(function(err) {
            document.getElementById('status').innerText = 'Error: ' + err.message;
          })
          .generatePdfRange(input);
      }
    </script>
  `)
  .setWidth(400)
  .setHeight(380);

  SpreadsheetApp.getUi().showModalDialog(html, 'Generate PDF');
}

// === PARSE ROW INPUT ===
// Parses input like "1000", "5-10", "2,3,10,20" into array of row numbers
function parseRowInput(input) {
  var rows = [];

  // Split by comma first
  var parts = input.split(',');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();

    if (part.indexOf('-') !== -1) {
      // Range: e.g. "5-10"
      var bounds = part.split('-');
      var start = parseInt(bounds[0].trim());
      var end = parseInt(bounds[1].trim());
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (var r = start; r <= end; r++) {
          rows.push(r);
        }
      }
    } else {
      // Single row
      var num = parseInt(part);
      if (!isNaN(num)) rows.push(num);
    }
  }

  // Remove duplicates
  return rows.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

// === GENERATE PDF ALL ===
// Generate PDF for all rows where M = "Approved by Admin" and BD is empty
function generatePdfAll() {
  var sheet = ss.getSheetByName('Vacation');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'No data found.';

  var allData = sheet.getDataRange().getValues();
  var targetRows = [];

  for (var i = 1; i < allData.length; i++) { // i=1 skip header
    var approvalStatus = allData[i][12] ? allData[i][12].toString().trim() : '';
    var pdfUrl = allData[i][55] ? allData[i][55].toString().trim() : '';
    if (approvalStatus === 'Approved by Admin' && pdfUrl === '') {
      targetRows.push(i + 1); // Convert to sheet row (1-based + header)
    }
  }

  if (targetRows.length === 0) return 'No rows to process. Either all PDFs exist or no "Approved by Admin" rows found.';

  var successCount = 0;
  var failCount = 0;

  for (var j = 0; j < targetRows.length; j++) {
    var result = generatePdfForRow(sheet, targetRows[j]);
    if (result) successCount++; else failCount++;
  }

  return 'Done! Success: ' + successCount + ' | Failed: ' + failCount + ' | Total processed: ' + targetRows.length;
}

// === GENERATE PDF RANGE ===
// Generate PDF for specific rows based on user input
function generatePdfRange(input) {
  var sheet = ss.getSheetByName('Vacation');
  var rows = parseRowInput(input);

  if (rows.length === 0) return 'Invalid input. Please check your row numbers.';

  var successCount = 0;
  var failCount = 0;
  var skippedCount = 0;

  for (var j = 0; j < rows.length; j++) {
    var sheetRow = rows[j]; // User inputs actual sheet row number (including header)
    var rowData = sheet.getRange(sheetRow, 1, 1, sheet.getLastColumn()).getValues()[0];

    var approvalStatus = rowData[12] ? rowData[12].toString().trim() : '';
    var pdfUrl = rowData[55] ? rowData[55].toString().trim() : '';

    // Skip if not approved or PDF already exists
    if (approvalStatus !== 'Approved by Admin') {
      skippedCount++;
      Logger.log('Row ' + sheetRow + ' skipped: not approved');
      continue;
    }
    if (pdfUrl !== '') {
      skippedCount++;
      Logger.log('Row ' + sheetRow + ' skipped: PDF already exists');
      continue;
    }

    var result = generatePdfForRow(sheet, sheetRow);
    if (result) successCount++; else failCount++;
  }

  return 'Done! Success: ' + successCount + ' | Failed: ' + failCount + ' | Skipped: ' + skippedCount;
}

// === CORE: GENERATE PDF FOR A SINGLE ROW ===
function generatePdfForRow(sheet, sheetRow) {
  try {
    var allData = sheet.getDataRange().getValues();
    var rowData = allData[sheetRow - 1]; // Convert to 0-based index

    var question3 = rowData[4] ? rowData[4].toString().trim() : '';
    var name3 = rowData[1] ? rowData[1].toString().trim() : '';

// Templet : '1xq161kF7zt5owlpsbdX3iTbJr9RHHKB0fDOrJABB3I4' : '1mdKOlv1ab7eB4es0dM-6qN_uz-Zr3m0yd9FH2Oxc7AY';
// Folder : '1nn7JX9PIu8rMlpGLlenumR6UkBjnLdqt' : '1QJg2A67cEq7jvvSp3k4h2aC0PLduTxFn';
    var templateId = (question3 === "Vacation" || question3 === "تمديد")
      ? '1xq161kF7zt5owlpsbdX3iTbJr9RHHKB0fDOrJABB3I4'
      : '1mdKOlv1ab7eB4es0dM-6qN_uz-Zr3m0yd9FH2Oxc7AY';

    var folderId = (question3 === "Vacation" || question3 === "تمديد")
      ? '1nn7JX9PIu8rMlpGLlenumR6UkBjnLdqt'
      : '1QJg2A67cEq7jvvSp3k4h2aC0PLduTxFn';

    var replacements;
    if (question3 === "Vacation" || question3 === "تمديد") {
      replacements = {
        '{Timestamp}': rowData[0] ? formatDate(rowData[0], 'YYYY-MM-DD') : '',
        '{Name}': rowData[48] ? rowData[48].toString() : '',
        '{ID}': rowData[2] ? rowData[2].toString() : '',
        '{Civil ID}': rowData[49] ? rowData[49].toString() : '',
        '{Nationality}': rowData[50] ? rowData[50].toString() : '',
        '{Job title}': rowData[51] ? rowData[51].toString() : '',
        '{Mobile No.}': rowData[52] ? rowData[52].toString() : '',
        '{المركز}': rowData[53] ? rowData[53].toString() : '',
        '{تاريخ التعيين بالوزارة}': rowData[54] ? formatDate(rowData[54], 'YYYY-MM-DD') : '',
        '{From Date}': rowData[5] ? formatDate(rowData[5], 'YYYY-MM-DD') : '',
        '{To Date}': rowData[6] ? formatDate(rowData[6], 'YYYY-MM-DD') : '',
        '{No.Days}': rowData[7] ? rowData[7] : ''
      };
    } else {
      var colT = rowData[19] !== "" && rowData[19] !== null ? Number(rowData[19]) : 0;
      var activeDays = Math.abs(Math.abs(colT + 1) - 4);
      var remainingDays = Math.abs(colT + 1);
      replacements = {
        '{Day}': rowData[24] ? rowData[24] : '',
        '{From Date}': rowData[5] ? formatDate(rowData[5], 'YYYY-MM-DD') : '',
        '{Name}': rowData[48] ? rowData[48].toString() : '',
        '{Civil ID}': rowData[49] ? rowData[49].toString() : '',
        '{ID}': rowData[2] ? rowData[2].toString() : '',
        '{Job title}': rowData[51] ? rowData[51].toString() : '',
        '{المركز}': rowData[53] ? rowData[53].toString() : '',
        '{ad}': activeDays.toString(),
        '{rd}': remainingDays.toString()
      };
    }

    // Copy template and replace labels
    var template = DriveApp.getFileById(templateId);
    var copy = template.makeCopy(
      name3 + ', ' + rowData[9] + ', ' + formatDate(rowData[5], 'YYYY-MM-DD'),
      DriveApp.getFolderById(folderId)
    );

    var doc = DocumentApp.openById(copy.getId());
    var body = doc.getBody();
    for (var label in replacements) {
      body.replaceText(label, replacements[label]);
    }
    doc.saveAndClose();

    // Convert to PDF
    var pdfBlob = copy.getAs('application/pdf');
    var pdfFile = DriveApp.getFolderById(folderId).createFile(pdfBlob);
    DriveApp.getFileById(copy.getId()).setTrashed(true);

    // Save PDF URL to column BD (56)
    sheet.getRange(sheetRow, 56).setValue(pdfFile.getUrl());

    Logger.log('Row ' + sheetRow + ' PDF generated: ' + pdfFile.getUrl());
    return true;

  } catch (e) {
    Logger.log('Row ' + sheetRow + ' Error: ' + e.toString());
    return false;
  }
}

function testRun() {
  let xx;
  let aa = 'abcd';
  let bb = 123;
  xx = aa == 'abc' || bb == 123 ? 'ok' : 'other';
  console.log('xx: ', xx)
}

// One-off diagnostic: measures how much the "Vacation" sheet's full-column-A scan in
// saveData3() (line ~241) actually costs vs. a range bounded to getLastRow(), on the
// real data. Run manually from the Apps Script editor (select this function, click Run),
// then check View > Logs. Safe to delete once you've read the results.
function diagnoseVacationSheetSize() {
  var sheet = ss.getSheetByName('Vacation');

  var maxRows = sheet.getMaxRows();  // total rows the sheet is sized to
  var lastRow = sheet.getLastRow();  // last row with content in ANY column

  // Current method: read the entire column A
  var t0 = Date.now();
  var fullColCount = sheet.getRange("A:A").getValues().filter(String).length;
  var fullColMs = Date.now() - t0;

  // Proposed method: read column A only up to getLastRow()
  var t1 = Date.now();
  var boundedCount = sheet.getRange(1, 1, lastRow, 1).getValues().filter(String).length;
  var boundedMs = Date.now() - t1;

  var report =
    'Vacation sheet diagnostic:\n' +
    '- Sheet dimension (getMaxRows): ' + maxRows + ' rows\n' +
    '- Last row with any content (getLastRow): ' + lastRow + '\n' +
    '- Extra empty rows read today past getLastRow(): ' + (maxRows - lastRow) + '\n' +
    '- Result match (both methods must agree): ' + (fullColCount === boundedCount ? 'YES' : 'MISMATCH - investigate before applying fix #3') + '\n' +
    '- Current method (full column A): ' + fullColCount + ' rows counted, took ' + fullColMs + ' ms\n' +
    '- Bounded method (up to getLastRow): ' + boundedCount + ' rows counted, took ' + boundedMs + ' ms\n' +
    '- Time saved per submission (approx): ' + (fullColMs - boundedMs) + ' ms';

  Logger.log(report);

  try {
    SpreadsheetApp.getUi().alert(report);
  } catch (e) {
    // No UI context available (e.g. triggered outside the Sheets editor) - Logger.log above still has the results.
  }

  return report;
}
