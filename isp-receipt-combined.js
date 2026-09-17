const $r=id=>document.getElementById(id);
const CLASS_RE=/(?:四技|二技|五專|二專|進修(?:部)?|碩士|碩研|博士)[\u3400-\u9fffA-Za-z0-9()（）／/、_-]*?[甲乙丙丁戊己]|技[\u3400-\u9fffA-Za-z0-9]{1,8}?[一二三四五六][甲乙丙丁戊己]|(?:日|夜)?[四二五][\u3400-\u9fffA-Za-z0-9]{1,8}?[一二三四五六][甲乙丙丁戊己]/;
const LOCATION_RE=/(?:樓|館|校區|教室|實驗室|室|場|中心|遠距|線上)/;
const WORD_NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const clean=v=>String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
let mergeStudents=[];

function maskName(name){
  const chars=Array.from(clean(name));
  if(chars.length<2)return clean(name);
  return `${chars[0]}○${chars.slice(2).join('')}`;
}
function safeSheetName(name,used){
  const base=(clean(name)||'未命名').replace(/[\\/*?:\[\]]/g,'_').slice(0,31)||'未命名';
  let out=base,n=2;
  while(used.has(out)){const s=`_${n++}`;out=`${base.slice(0,31-s.length)}${s}`;}
  used.add(out);return out;
}
function nodeText(node){
  const parts=[];
  const walk=n=>{
    if(n.nodeType===3){parts.push(n.nodeValue||'');return;}
    if(n.localName==='tab')parts.push(' ');
    if(n.localName==='br'||n.localName==='cr')parts.push('\n');
    [...(n.childNodes||[])].forEach(walk);
  };
  walk(node);return parts.join('').replace(/\u00a0/g,' ');
}
function paragraphLines(cell){
  const ps=[...cell.getElementsByTagNameNS(WORD_NS,'p')];
  const lines=ps.map(p=>clean(nodeText(p))).filter(Boolean);
  if(lines.length>1)return lines;
  return nodeText(cell).split(/\n+/).map(clean).filter(Boolean);
}
function teacherFromAfter(lines){
  for(const line of lines){
    const v=clean(line);
    if(!v||LOCATION_RE.test(v))continue;
    const m=v.match(/^([\u3400-\u9fff]{2,4})(?:老師)?(?:\s|$|[A-Za-z0-9])/);
    if(m)return m[1];
    if(/^[\u3400-\u9fff]{2,4}$/.test(v))return v;
  }
  return '';
}
function parseCourseCell(cell){
  const lines=paragraphLines(cell);
  const classIndex=lines.findIndex(x=>CLASS_RE.test(x));
  if(classIndex>=0){
    const classMatch=lines[classIndex].match(CLASS_RE);
    const courseName=clean(lines.slice(0,classIndex).join(' '));
    const after=[clean(lines[classIndex].replace(classMatch?.[0]||'','')),...lines.slice(classIndex+1)].filter(Boolean);
    const teacher=teacherFromAfter(after);
    if(courseName&&classMatch?.[0]&&teacher)return {courseName,className:classMatch[0],teacher};
  }
  const flat=clean(nodeText(cell)),cm=flat.match(CLASS_RE);
  if(!cm||!cm.index)return null;
  const courseName=clean(flat.slice(0,cm.index));
  const after=clean(flat.slice(cm.index+cm[0].length));
  const teacher=after.match(/^([\u3400-\u9fff]{2,4})(?:老師)?/)?.[1]||'';
  return courseName&&teacher?{courseName,className:cm[0],teacher}:null;
}
async function parseFile(file){
  const zip=new window.PizZip(await file.arrayBuffer());
  const xmlFile=zip.file('word/document.xml');
  if(!xmlFile)throw new Error('不是可辨識的 Word 課表');
  const xml=new DOMParser().parseFromString(xmlFile.asText(),'application/xml');
  if(xml.getElementsByTagName('parsererror').length)throw new Error('Word 內容無法讀取');
  const allText=clean(nodeText(xml.documentElement));
  const id=allText.match(/學號\s*(?:\(\s*Std\.?\s*ID\s*\))?\s*[:：]?\s*([A-Za-z]\d{7,12}|\d{7,12})/i)?.[1]||'';
  const name=allText.match(/姓名\s*(?:\(\s*Name\s*\))?\s*[:：]?\s*([\u3400-\u9fffO○〇]{2,10})/i)?.[1]||'';
  const studentClass=allText.match(/班級\s*[:：]?\s*((?:四技|二技|五專|二專|進修(?:部)?|碩士|碩研|博士)[\u3400-\u9fffA-Za-z0-9()（）／/、_-]*?[甲乙丙丁戊己])/)?.[1]||'';
  if(!name)throw new Error('找不到學生姓名');
  const tables=[...xml.getElementsByTagNameNS(WORD_NS,'tbl')];
  if(!tables.length)throw new Error('找不到課表表格');
  const rows=[...tables[0].getElementsByTagNameNS(WORD_NS,'tr')];
  const courses=[],seen=new Set();
  for(const row of rows.slice(1))for(const cell of [...row.childNodes].filter(n=>n.localName==='tc').slice(1)){
    const c=parseCourseCell(cell);if(!c)continue;
    const key=`${c.courseName}|${c.className}|${c.teacher}`;
    if(!seen.has(key)){seen.add(key);courses.push(c);}
  }
  if(!courses.length)throw new Error('找不到可辨識的課程與任課老師');
  return {key:id||`${name}-${file.name}`,fileName:file.name,name,id,studentClass,courses};
}
function currentReviewedClass(fileName,fallback){
  const rows=[...document.querySelectorAll('#receiptReviewBody tr')];
  const row=rows.find(r=>clean(r.cells?.[0]?.textContent)===clean(fileName));
  return clean(row?.querySelector('.receipt-class-input')?.value)||fallback;
}
async function loadMergeStudents(){
  if(!window.PizZip)throw new Error('Word 讀取元件尚未載入，請重新整理後再試');
  const files=[...($r('receiptFiles')?.files||[])];
  if(!files.length)throw new Error('請先匯入整理後的 Word 課表');
  const parsed=[],errors=[];
  for(const file of files){try{parsed.push(await parseFile(file));}catch(e){errors.push(`${file.name}：${e.message}`);}}
  if(!parsed.length)throw new Error(errors.join('；')||'沒有可用的課表');
  parsed.forEach(s=>s.studentClass=currentReviewedClass(s.fileName,s.studentClass));
  if(parsed.some(s=>!s.studentClass))throw new Error('仍有學生缺少班級，請先在上方確認班級');
  if(errors.length)alert(`有 ${errors.length} 份課表無法加入共同老師整理：\n${errors.join('\n')}`);
  mergeStudents=parsed;
  return parsed;
}
function sharedTeachers(students){
  const map=new Map();
  students.forEach(student=>{
    const own=new Map();
    student.courses.forEach(course=>{
      if(!course.teacher)return;
      if(!own.has(course.teacher))own.set(course.teacher,[]);
      if(!own.get(course.teacher).some(x=>x.courseName===course.courseName))own.get(course.teacher).push(course);
    });
    own.forEach((courses,teacher)=>{
      if(!map.has(teacher))map.set(teacher,[]);
      map.get(teacher).push({student,courses});
    });
  });
  return [...map.entries()].filter(([,items])=>items.length>=2).sort(([a],[b])=>a.localeCompare(b,'zh-Hant'));
}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
function renderMergePanel(students){
  const panel=$r('sharedTeacherMergePanel'),list=$r('sharedTeacherMergeList');
  const shared=sharedTeachers(students);list.innerHTML='';
  if(!shared.length){list.innerHTML='<div class="timetable-notice">目前沒有找到 2 位以上學生共同的任課老師，不需要合併。</div>';panel.classList.remove('hidden');return;}
  shared.forEach(([teacher,items])=>{
    const card=document.createElement('div');card.className='official-fieldset shared-teacher-card';card.dataset.teacher=teacher;card.dataset.members=items.map(({student})=>student.key).join('||');
    const options=items.map(({student})=>`<option value="${escHtml(student.key)}">${escHtml(maskName(student.name))}｜${escHtml(student.studentClass)}</option>`).join('');
    card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><strong>${escHtml(teacher)}老師｜${items.length} 位學生將一起合併</strong><label>由哪位學生送<select class="merge-carrier"><option value="">尚未設定</option>${options}</select></label></div><div class="merge-student-options" style="margin-top:10px"></div>`;
    const box=card.querySelector('.merge-student-options');
    items.forEach(({student,courses})=>{
      const line=document.createElement('div');line.style.margin='7px 0';
      line.innerHTML=`<strong>${escHtml(maskName(student.name))}</strong>（${escHtml(student.studentClass)}）－ ${escHtml(courses.map(c=>c.courseName).join('、'))}`;
      box.appendChild(line);
    });
    list.appendChild(card);
  });
  panel.classList.remove('hidden');panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function collectPlans(){
  const plans=[];
  document.querySelectorAll('.shared-teacher-card').forEach(card=>{
    const teacher=card.dataset.teacher,carrier=card.querySelector('.merge-carrier')?.value||'';
    const members=(card.dataset.members||'').split('||').filter(Boolean);
    if(!carrier)throw new Error(`${teacher}老師：請選擇由哪位學生送`);
    plans.push({teacher,carrier,members:new Set(members)});
  });
  return plans;
}
function mergedStudentRows(students,plans){
  const planByTeacher=new Map(plans.map(p=>[p.teacher,p]));
  const result=new Map(students.map(s=>[s.key,{student:s,teachers:new Map()}]));
  students.forEach(student=>student.courses.forEach(course=>{
    const plan=planByTeacher.get(course.teacher);
    if(plan&&plan.members.has(student.key)){
      const target=result.get(plan.carrier),arr=target.teachers.get(course.teacher)||[];
      const record={studentName:maskName(student.name),courseName:course.courseName,merged:true};
      if(!arr.some(x=>x.studentName===record.studentName&&x.courseName===record.courseName))arr.push(record);
      target.teachers.set(course.teacher,arr);
    }else{
      const target=result.get(student.key),arr=target.teachers.get(course.teacher)||[];
      const record={studentName:maskName(student.name),courseName:course.courseName,merged:false};
      if(!arr.some(x=>x.courseName===record.courseName&&!x.merged))arr.push(record);
      target.teachers.set(course.teacher,arr);
    }
  }));
  return [...result.values()].filter(x=>x.teachers.size>0);
}
function courseDisplay(records){
  if(!records.length)return '';
  if(records.every(x=>!x.merged))return [...new Set(records.map(x=>x.courseName))].join('\n');
  const byCourse=new Map();
  records.forEach(record=>{
    if(!byCourse.has(record.courseName))byCourse.set(record.courseName,[]);
    const names=byCourse.get(record.courseName);
    if(!names.includes(record.studentName))names.push(record.studentName);
  });
  return [...byCourse.entries()].map(([course,names])=>`${names.join('\n')}－${course}`).join('\n\n');
}
const thinBorder={top:{style:'thin',color:{argb:'FF000000'}},left:{style:'thin',color:{argb:'FF000000'}},bottom:{style:'thin',color:{argb:'FF000000'}},right:{style:'thin',color:{argb:'FF000000'}}};
function styleRange(sheet,fromRow,toRow,fromCol,toCol,{fill=null,bold=false,size=12}={}){
  for(let row=fromRow;row<=toRow;row++)for(let col=fromCol;col<=toCol;col++){
    const cell=sheet.getCell(row,col);cell.font={name:'標楷體',size,bold};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};cell.border=thinBorder;if(fill)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};
  }
}
function setupSheet(sheet){sheet.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.35,right:0.35,top:0.45,bottom:0.45,header:0.2,footer:0.2}};sheet.properties.defaultRowHeight=24;sheet.views=[{showGridLines:false}];}
async function buildStudentMergeWorkbook(students,plans){
  if(!window.ExcelJS||!window.saveAs)throw new Error('Excel 元件尚未載入，請重新整理後再試');
  const academicYear=clean($r('receiptAcademicYear')?.value),semester=clean($r('receiptSemester')?.value);
  if(!academicYear)throw new Error('請先填寫學年度');
  const rows=mergedStudentRows(students,plans),workbook=new window.ExcelJS.Workbook();workbook.creator='明新科技大學資源教室';const used=new Set();
  rows.sort((a,b)=>a.student.name.localeCompare(b.student.name,'zh-Hant')).forEach(({student,teachers})=>{
    const masked=maskName(student.name),sheet=workbook.addWorksheet(safeSheetName(masked,used));setupSheet(sheet);
    sheet.columns=[{width:8},{width:18},{width:18},{width:18},{width:18},{width:18}];
    sheet.mergeCells('A1:B2');sheet.mergeCells('C1:C2');sheet.mergeCells('D1:F2');
    sheet.getCell('A1').value=`${academicYear}學年度`;sheet.getCell('C1').value=semester==='3'?'暑期':`第${semester}學期`;sheet.getCell('D1').value='個別化支持計畫（ISP）簽收單';
    styleRange(sheet,1,2,1,6,{bold:true,size:14});sheet.getRow(1).height=30;sheet.getRow(2).height=30;
    sheet.getCell('A4').value='班級：';sheet.getCell('B4').value=student.studentClass;sheet.getCell('C4').value='學生：';sheet.getCell('D4').value=masked;
    for(let col=1;col<=4;col++){const cell=sheet.getCell(4,col);cell.font={name:'標楷體',size:12,bold:true};cell.alignment={horizontal:'center',vertical:'middle'};}
    sheet.mergeCells('A7:A8');sheet.mergeCells('B7:D8');sheet.mergeCells('E7:E8');sheet.mergeCells('F7:F8');
    sheet.getCell('A7').value='序號';sheet.getCell('B7').value='課程';sheet.getCell('E7').value='授課教師';sheet.getCell('F7').value='簽收';styleRange(sheet,7,8,1,6,{fill:'FFD9EAF7',bold:true});
    let row=9,index=1;
    [...teachers.entries()].sort(([a],[b])=>a.localeCompare(b,'zh-Hant')).forEach(([teacher,records])=>{
      const display=courseDisplay(records),lineCount=Math.max(1,display.split('\n').length);
      sheet.getCell(row,1).value=index++;sheet.mergeCells(row,2,row,4);sheet.getCell(row,2).value=display;sheet.getCell(row,5).value=teacher;sheet.getCell(row,6).value='';styleRange(sheet,row,row,1,6);sheet.getRow(row).height=Math.max(30,lineCount*22);row++;
    });
    sheet.pageSetup.printArea=`A1:F${Math.max(row-1,9)}`;
  });
  const buffer=await workbook.xlsx.writeBuffer();
  window.saveAs(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`${academicYear}-${semester}_ISP簽收單_學生版共同老師合併.xlsx`);
}
function install(){
  const studentBtn=$r('downloadStudentReceiptBtn');if(!studentBtn)return;
  const old=$r('downloadCombinedReceiptBtn');if(old)old.remove();
  document.querySelectorAll('.combined-receipt-old-hint').forEach(x=>x.remove());
  if($r('setupSharedTeacherMergeBtn'))return;
  const button=document.createElement('button');button.type='button';button.id='setupSharedTeacherMergeBtn';button.className='primary';button.textContent='學生版－共同老師合併';studentBtn.insertAdjacentElement('afterend',button);
  const panel=document.createElement('div');panel.id='sharedTeacherMergePanel';panel.className='editor-card hidden';panel.style.marginTop='14px';panel.innerHTML='<h3>共同老師手動合併</h3><div class="timetable-notice">以「學生為主」簽收單為基底。上方列出的共同老師會直接合併，不需要再勾選；只要指定由哪位學生代送即可。其他老師與課程維持原狀。</div><div id="sharedTeacherMergeList"></div><div class="actions"><button type="button" id="downloadSharedTeacherMergeBtn" class="primary">套用合併並下載 Excel</button><button type="button" id="clearSharedTeacherMergeBtn" class="secondary">清除代送設定</button></div>';
  $r('receiptReview')?.appendChild(panel);
  button.addEventListener('click',async()=>{const oldText=button.textContent;button.disabled=true;button.textContent='分析共同老師中…';try{renderMergePanel(await loadMergeStudents());}catch(e){alert(e.message||'共同老師分析失敗');}finally{button.disabled=false;button.textContent=oldText;}});
  panel.querySelector('#clearSharedTeacherMergeBtn').onclick=()=>{panel.querySelectorAll('.merge-carrier').forEach(x=>x.value='');};
  panel.querySelector('#downloadSharedTeacherMergeBtn').onclick=async()=>{const btn=panel.querySelector('#downloadSharedTeacherMergeBtn'),oldText=btn.textContent;btn.disabled=true;btn.textContent='產生中…';try{if(!mergeStudents.length)await loadMergeStudents();await buildStudentMergeWorkbook(mergeStudents,collectPlans());}catch(e){console.error(e);alert(e.message||'合併版產生失敗');}finally{btn.disabled=false;btn.textContent=oldText;}};
}
install();new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});