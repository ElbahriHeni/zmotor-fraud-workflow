const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { FRAUD_ASSESSMENTS, getFraudAssessmentDefinition } = require('./fraud-assessment-config');

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'fraud-assessment-template.xlsx');

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = table[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('Invalid XLSX ZIP: end-of-central-directory record not found.');
}

function parseZip(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Invalid XLSX ZIP: central directory entry is malformed.');
    }

    const versionMadeBy = buffer.readUInt16LE(cursor + 4);
    const versionNeeded = buffer.readUInt16LE(cursor + 6);
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const modTime = buffer.readUInt16LE(cursor + 12);
    const modDate = buffer.readUInt16LE(cursor + 14);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const internalAttributes = buffer.readUInt16LE(cursor + 36);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileNameBuffer = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength);
    const fileName = fileNameBuffer.toString((flags & 0x800) ? 'utf8' : 'utf8');
    const centralExtra = buffer.subarray(cursor + 46 + fileNameLength, cursor + 46 + fileNameLength + extraLength);
    const comment = buffer.subarray(cursor + 46 + fileNameLength + extraLength, cursor + 46 + fileNameLength + extraLength + commentLength);

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid XLSX ZIP: local header missing for ${fileName}.`);
    }

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);

    let data;
    if (method === 0) data = Buffer.from(compressedData);
    else if (method === 8) data = zlib.inflateRawSync(compressedData);
    else throw new Error(`Unsupported XLSX ZIP compression method ${method} for ${fileName}.`);

    if (data.length !== uncompressedSize) {
      throw new Error(`Invalid XLSX ZIP: size mismatch for ${fileName}.`);
    }

    entries.push({
      fileName,
      data,
      versionMadeBy,
      versionNeeded,
      flags,
      method,
      modTime,
      modDate,
      internalAttributes,
      externalAttributes,
      centralExtra: Buffer.from(centralExtra),
      comment: Buffer.from(comment),
    });

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function buildZip(entries) {
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.fileName, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const isDirectory = entry.fileName.endsWith('/');
    const method = isDirectory ? 0 : 8;
    const compressedData = method === 0 ? data : zlib.deflateRawSync(data, { level: 6 });
    const checksum = crc32(data);
    const flags = (entry.flags | 0x800) & ~0x08;
    const versionNeeded = method === 8 ? Math.max(entry.versionNeeded || 20, 20) : (entry.versionNeeded || 10);
    const localExtra = Buffer.alloc(0);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(versionNeeded, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(entry.modTime || 0, 10);
    localHeader.writeUInt16LE(entry.modDate || 0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(localExtra.length, 28);

    localChunks.push(localHeader, fileName, localExtra, compressedData);

    const centralExtra = entry.centralExtra || Buffer.alloc(0);
    const comment = entry.comment || Buffer.alloc(0);
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(entry.versionMadeBy || 20, 4);
    centralHeader.writeUInt16LE(versionNeeded, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(entry.modTime || 0, 12);
    centralHeader.writeUInt16LE(entry.modDate || 0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressedData.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(centralExtra.length, 30);
    centralHeader.writeUInt16LE(comment.length, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(entry.internalAttributes || 0, 36);
    centralHeader.writeUInt32LE(entry.externalAttributes || 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralChunks.push(centralHeader, fileName, centralExtra, comment);
    localOffset += localHeader.length + fileName.length + localExtra.length + compressedData.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDirectory, eocd]);
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function preserveWhitespaceAttribute(value) {
  return /^\s|\s$|\n|\r/.test(value) ? ' xml:space="preserve"' : '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function columnNumber(columnLetters) {
  let value = 0;
  for (const character of columnLetters) {
    value = (value * 26) + character.charCodeAt(0) - 64;
  }
  return value;
}

function setInlineStringCell(xml, ref, value) {
  const escapedRef = escapeRegExp(ref);
  const cellRegex = new RegExp(
    `<c\\b([^>]*\\br="${escapedRef}"[^>]*)\\s*\\/>|<c\\b([^>]*\\br="${escapedRef}"[^>]*)>[\\s\\S]*?<\\/c>`
  );
  const match = xml.match(cellRegex);
  const text = String(value ?? '');

  if (match) {
    const attrs = match[1] || match[2] || '';
    const style = attrs.match(/\bs="([^"]+)"/)?.[1];
    const replacement = `<c r="${ref}"${style ? ` s="${style}"` : ''} t="inlineStr"><is><t${preserveWhitespaceAttribute(text)}>${xmlEscape(text)}</t></is></c>`;
    return xml.replace(cellRegex, replacement);
  }

  const refMatch = ref.match(/^([A-Z]+)(\d+)$/);
  if (!refMatch) throw new Error(`Invalid Excel cell reference ${ref}.`);

  const targetColumn = columnNumber(refMatch[1]);
  const rowNumber = refMatch[2];
  const rowRegex = new RegExp(`(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)([\\s\\S]*?)(<\\/row>)`);
  const rowMatch = xml.match(rowRegex);
  if (!rowMatch) throw new Error(`Excel template row ${rowNumber} was not found for cell ${ref}.`);

  let style = null;
  const rowBody = rowMatch[2];
  const cellStartRegex = /<c\b([^>]*\br="([A-Z]+)\d+"[^>]*)/g;
  let cellMatch;
  const cells = [];
  while ((cellMatch = cellStartRegex.exec(rowBody))) {
    const column = columnNumber(cellMatch[2]);
    const cellStyle = cellMatch[1].match(/\bs="([^"]+)"/)?.[1] || null;
    cells.push({ index: cellMatch.index, column, style: cellStyle });
  }

  if (cells.length > 0) {
    const nearest = [...cells].sort(
      (a, b) => Math.abs(a.column - targetColumn) - Math.abs(b.column - targetColumn)
    )[0];
    style = nearest.style;
  }

  const cellXml = `<c r="${ref}"${style ? ` s="${style}"` : ''} t="inlineStr"><is><t${preserveWhitespaceAttribute(text)}>${xmlEscape(text)}</t></is></c>`;
  const nextCell = cells.find((cell) => cell.column > targetColumn);
  const insertionIndex = nextCell ? nextCell.index : rowBody.length;
  const nextBody = `${rowBody.slice(0, insertionIndex)}${cellXml}${rowBody.slice(insertionIndex)}`;
  const replacementRow = `${rowMatch[1]}${nextBody}${rowMatch[3]}`;

  return xml.replace(rowRegex, replacementRow);
}

function setBooleanCell(xml, ref, checked) {
  const escapedRef = escapeRegExp(ref);
  const cellRegex = new RegExp(
    `<c\\b([^>]*\\br="${escapedRef}"[^>]*)\\s*\\/>|<c\\b([^>]*\\br="${escapedRef}"[^>]*)>[\\s\\S]*?<\\/c>`
  );
  const match = xml.match(cellRegex);
  if (!match) throw new Error(`Excel template cell ${ref} was not found.`);
  const attrs = match[1] || match[2] || '';
  const style = attrs.match(/\bs="([^"]+)"/)?.[1];
  const replacement = `<c r="${ref}"${style ? ` s="${style}"` : ''} t="b"><v>${checked ? 1 : 0}</v></c>`;
  return xml.replace(cellRegex, replacement);
}

function setCachedFormulaValue(xml, ref, checked) {
  const cellRegex = new RegExp(`(<c\\b[^>]*\\br="${escapeRegExp(ref)}"[^>]*>[\\s\\S]*?<v>)([^<]*)(<\\/v>[\\s\\S]*?<\\/c>)`);
  if (!cellRegex.test(xml)) return xml;
  return xml.replace(cellRegex, `$1${checked ? 1 : 0}$3`);
}

function setControlChecked(xml, checked) {
  let next = xml.replace(/\schecked="[^"]*"/g, '');
  if (checked) next = next.replace('<formControlPr ', '<formControlPr checked="Checked" ');
  return next;
}

function updateVmlCheckboxStates(xml, checkboxStates) {
  return xml.replace(/<v:shape\b[\s\S]*?<\/v:shape>/g, (shape) => {
    const linkMatch = shape.match(/<x:FmlaLink>Checkboxes!\$D\$(\d+)<\/x:FmlaLink>/);
    if (!linkMatch) return shape;
    const row = Number(linkMatch[1]);
    if (!(row in checkboxStates)) return shape;

    let next = shape.replace(/\s*<x:Checked>[^<]*<\/x:Checked>/g, '');
    if (checkboxStates[row]) {
      next = next.replace('</x:ClientData>', '   <x:Checked>1</x:Checked>\n  </x:ClientData>');
    }
    return next;
  });
}


function normalizeAnswerMap(definition, answers) {
  const map = new Map();
  for (const answer of Array.isArray(answers) ? answers : []) {
    if (!answer || !definition.questionRows[answer.question_code]) continue;
    map.set(answer.question_code, {
      answer: Array.isArray(answer.answer) ? answer.answer.map(String) : String(answer.answer ?? ''),
      comments: String(answer.comments ?? ''),
      other_text: String(answer.other_text ?? ''),
    });
  }
  return map;
}

function answerHasOption(answer, option) {
  if (!answer) return false;
  if (Array.isArray(answer.answer)) return answer.answer.includes(option);
  return answer.answer === option;
}

function mergeOtherIntoComments(answer) {
  const comments = String(answer?.comments ?? '').trim();
  const other = String(answer?.other_text ?? '').trim();
  if (!other || !answerHasOption(answer, 'Other, please specify')) return comments;
  const otherLine = `Other, please specify: ${other}`;
  return comments ? `${comments}\n${otherLine}` : otherLine;
}

function setColumnHidden(xml, columnNumber) {
  return xml.replace(/<cols>([\s\S]*?)<\/cols>/, (full, inner) => {
    const parts = [];
    let changed = false;

    const nextInner = inner.replace(/<col\b([^>]*)\/>/g, (match, attrsText) => {
      const minMatch = attrsText.match(/\bmin="(\d+)"/);
      const maxMatch = attrsText.match(/\bmax="(\d+)"/);
      if (!minMatch || !maxMatch) return match;

      const min = Number(minMatch[1]);
      const max = Number(maxMatch[1]);
      if (columnNumber < min || columnNumber > max) return match;

      changed = true;
      const cleanAttrs = attrsText
        .replace(/\smin="\d+"/, '')
        .replace(/\smax="\d+"/, '')
        .replace(/\shidden="[^"]*"/, '');

      const makeCol = (from, to, hidden) =>
        `<col min="${from}" max="${to}"${cleanAttrs}${hidden ? ' hidden="1"' : ''}/>`;

      if (min === max) return makeCol(min, max, true);

      const replacement = [];
      if (min < columnNumber) replacement.push(makeCol(min, columnNumber - 1, false));
      replacement.push(makeCol(columnNumber, columnNumber, true));
      if (columnNumber < max) replacement.push(makeCol(columnNumber + 1, max, false));
      return replacement.join('');
    });

    if (!changed) {
      parts.push(`<col min="${columnNumber}" max="${columnNumber}" hidden="1"/>`);
    }

    return `<cols>${nextInner}${parts.join('')}</cols>`;
  });
}

function setWorkbookVisibility(xml, selectedSheetName, selectedSheetIndex) {
  let next = xml.replace(/<sheet\b([^>]*?)\/>/g, (match, attrsText) => {
    const nameMatch = attrsText.match(/\bname="([^"]+)"/);
    if (!nameMatch) return match;

    const decodedName = nameMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const withoutState = attrsText.replace(/\sstate="[^"]*"/, '');
    if (decodedName === selectedSheetName) {
      return `<sheet${withoutState}/>`;
    }
    return `<sheet${withoutState} state="hidden"/>`;
  });

  next = next.replace(/<workbookView\b([^>]*)\/>/, (match, attrs) => {
    const clean = attrs
      .replace(/\sactiveTab="[^"]*"/g, '')
      .replace(/\sfirstSheet="[^"]*"/g, '');
    return `<workbookView${clean} activeTab="${selectedSheetIndex}" firstSheet="${selectedSheetIndex}"/>`;
  });

  return next;
}


function setWorkbookAllAssessmentVisibility(xml) {
  const assessmentSheetNames = new Set(
    Object.values(FRAUD_ASSESSMENTS).map((definition) => definition.sheetName)
  );

  let next = xml.replace(/<sheet\b([^>]*?)\/>/g, (match, attrsText) => {
    const nameMatch = attrsText.match(/\bname="([^"]+)"/);
    if (!nameMatch) return match;

    const decodedName = nameMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const withoutState = attrsText.replace(/\sstate="[^"]*"/, '');
    if (assessmentSheetNames.has(decodedName)) {
      return `<sheet${withoutState}/>`;
    }

    // Keep Lookup, Checkboxes, Instructions and NAVIGATOR out of the user-facing export.
    return `<sheet${withoutState} state="hidden"/>`;
  });

  const firstAssessmentIndex = Math.min(
    ...Object.values(FRAUD_ASSESSMENTS).map((definition) => definition.workbookSheetIndex)
  );

  next = next.replace(/<workbookView\b([^>]*)\/>/, (match, attrs) => {
    const clean = attrs
      .replace(/\sactiveTab="[^"]*"/g, '')
      .replace(/\sfirstSheet="[^"]*"/g, '');
    return `<workbookView${clean} activeTab="${firstAssessmentIndex}" firstSheet="${firstAssessmentIndex}"/>`;
  });

  return next;
}

function applyAssessmentAnswersToEntries(entries, entryMap, definition, answers, checkboxStates) {
  const answerMap = normalizeAnswerMap(definition, answers);
  const assessmentSheet = entryMap.get(definition.sheetPath);
  if (!assessmentSheet) {
    throw new Error(`Fraud assessment Excel template is missing worksheet '${definition.sheetName}'.`);
  }

  let assessmentXml = assessmentSheet.data.toString('utf8');
  for (const [questionCode, row] of Object.entries(definition.questionRows)) {
    const answer = answerMap.get(questionCode) || { answer: '', comments: '', other_text: '' };
    if (definition.textQuestionCodes.has(questionCode)) {
      assessmentXml = setInlineStringCell(
        assessmentXml,
        `C${row}`,
        typeof answer.answer === 'string' ? answer.answer : answer.answer.join(', ')
      );
    }
    assessmentXml = setInlineStringCell(assessmentXml, `D${row}`, mergeOtherIntoComments(answer));
  }

  // Hide the Glossary column on every assessment sheet.
  assessmentXml = setColumnHidden(assessmentXml, 5);
  assessmentSheet.data = Buffer.from(assessmentXml, 'utf8');

  for (const [rowText, config] of Object.entries(definition.checkboxRows)) {
    const row = Number(rowText);
    checkboxStates[row] = answerHasOption(answerMap.get(config.questionCode), config.option);
  }
}

function applyCheckboxStates(entries, entryMap, checkboxStates) {
  const checkboxesSheet = entryMap.get('xl/worksheets/sheet2.xml');
  if (!checkboxesSheet) {
    throw new Error('Fraud assessment Excel template is missing the Checkboxes worksheet.');
  }

  let checkboxXml = checkboxesSheet.data.toString('utf8');
  for (const [rowText, selected] of Object.entries(checkboxStates)) {
    const row = Number(rowText);
    checkboxXml = setBooleanCell(checkboxXml, `D${row}`, Boolean(selected));
    checkboxXml = setCachedFormulaValue(checkboxXml, `E${row}`, Boolean(selected));
  }
  checkboxesSheet.data = Buffer.from(checkboxXml, 'utf8');

  for (const entry of entries) {
    if (/^xl\/ctrlProps\/ctrlProp\d+\.xml$/.test(entry.fileName)) {
      const xml = entry.data.toString('utf8');
      const link = xml.match(/fmlaLink="Checkboxes!\$D\$(\d+)"/);
      if (link && Number(link[1]) in checkboxStates) {
        entry.data = Buffer.from(
          setControlChecked(xml, Boolean(checkboxStates[Number(link[1])])),
          'utf8'
        );
      }
    }
  }

  for (const definition of Object.values(FRAUD_ASSESSMENTS)) {
    const vml = definition.vmlPath ? entryMap.get(definition.vmlPath) : null;
    if (vml) {
      vml.data = Buffer.from(
        updateVmlCheckboxStates(vml.data.toString('utf8'), checkboxStates),
        'utf8'
      );
    }
  }
}

function forceWorkbookRecalculation(workbookXml) {
  return workbookXml.replace(/<calcPr\b([^>]*)\/>/, (match, attrs) => {
    const cleaned = attrs
      .replace(/\sfullCalcOnLoad="[^"]*"/g, '')
      .replace(/\sforceFullCalc="[^"]*"/g, '')
      .replace(/\scalcMode="[^"]*"/g, '');
    return `<calcPr${cleaned} calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>`;
  });
}

function buildAllFraudAssessmentsExcel(answersByAssessmentCode = {}) {
  const entries = parseZip(fs.readFileSync(TEMPLATE_PATH));
  const entryMap = new Map(entries.map((entry) => [entry.fileName, entry]));
  const checkboxStates = {};

  for (const definition of Object.values(FRAUD_ASSESSMENTS)) {
    applyAssessmentAnswersToEntries(
      entries,
      entryMap,
      definition,
      answersByAssessmentCode[definition.code] || [],
      checkboxStates
    );
  }

  applyCheckboxStates(entries, entryMap, checkboxStates);

  const workbook = entryMap.get('xl/workbook.xml');
  if (workbook) {
    let workbookXml = workbook.data.toString('utf8');
    workbookXml = setWorkbookAllAssessmentVisibility(workbookXml);
    workbookXml = forceWorkbookRecalculation(workbookXml);
    workbook.data = Buffer.from(workbookXml, 'utf8');
  }

  return buildZip(entries);
}

function buildFraudAssessmentExcel(assessmentCode, answers) {
  const definition = getFraudAssessmentDefinition(assessmentCode);
  if (!definition) {
    throw new Error(`Unknown fraud assessment code '${assessmentCode}'.`);
  }

  const answerMap = normalizeAnswerMap(definition, answers);
  const entries = parseZip(fs.readFileSync(TEMPLATE_PATH));
  const entryMap = new Map(entries.map((entry) => [entry.fileName, entry]));

  const assessmentSheet = entryMap.get(definition.sheetPath);
  const checkboxesSheet = entryMap.get('xl/worksheets/sheet2.xml');
  if (!assessmentSheet || !checkboxesSheet) {
    throw new Error('Fraud assessment Excel template is missing the expected worksheets.');
  }

  let assessmentXml = assessmentSheet.data.toString('utf8');
  for (const [questionCode, row] of Object.entries(definition.questionRows)) {
    const answer = answerMap.get(questionCode) || { answer: '', comments: '', other_text: '' };
    if (definition.textQuestionCodes.has(questionCode)) {
      assessmentXml = setInlineStringCell(
        assessmentXml,
        `C${row}`,
        typeof answer.answer === 'string' ? answer.answer : answer.answer.join(', ')
      );
    }
    assessmentXml = setInlineStringCell(assessmentXml, `D${row}`, mergeOtherIntoComments(answer));
  }

  // The application deliberately does not expose the Glossary.
  // Hide the original Glossary column in exported assessment files as well.
  assessmentXml = setColumnHidden(assessmentXml, 5);
  assessmentSheet.data = Buffer.from(assessmentXml, 'utf8');

  const checkboxStates = {};
  let checkboxXml = checkboxesSheet.data.toString('utf8');
  for (const [rowText, config] of Object.entries(definition.checkboxRows)) {
    const row = Number(rowText);
    const selected = answerHasOption(answerMap.get(config.questionCode), config.option);
    checkboxStates[row] = selected;
    checkboxXml = setBooleanCell(checkboxXml, `D${row}`, selected);
    checkboxXml = setCachedFormulaValue(checkboxXml, `E${row}`, selected);
  }
  checkboxesSheet.data = Buffer.from(checkboxXml, 'utf8');

  for (const entry of entries) {
    if (/^xl\/ctrlProps\/ctrlProp\d+\.xml$/.test(entry.fileName)) {
      const xml = entry.data.toString('utf8');
      const link = xml.match(/fmlaLink="Checkboxes!\$D\$(\d+)"/);
      if (link && Number(link[1]) in checkboxStates) {
        entry.data = Buffer.from(setControlChecked(xml, checkboxStates[Number(link[1])]), 'utf8');
      }
    }
  }

  const vml = definition.vmlPath ? entryMap.get(definition.vmlPath) : null;
  if (vml) {
    vml.data = Buffer.from(
      updateVmlCheckboxStates(vml.data.toString('utf8'), checkboxStates),
      'utf8'
    );
  }

  const workbook = entryMap.get('xl/workbook.xml');
  if (workbook) {
    let workbookXml = workbook.data.toString('utf8');
    workbookXml = setWorkbookVisibility(
      workbookXml,
      definition.sheetName,
      definition.workbookSheetIndex
    );
    workbookXml = workbookXml.replace(/<calcPr\b([^>]*)\/>/, (match, attrs) => {
      const cleaned = attrs
        .replace(/\sfullCalcOnLoad="[^"]*"/g, '')
        .replace(/\sforceFullCalc="[^"]*"/g, '')
        .replace(/\scalcMode="[^"]*"/g, '');
      return `<calcPr${cleaned} calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>`;
    });
    workbook.data = Buffer.from(workbookXml, 'utf8');
  }

  return buildZip(entries);
}

module.exports = {
  buildFraudAssessmentExcel,
  buildAllFraudAssessmentsExcel,
};
