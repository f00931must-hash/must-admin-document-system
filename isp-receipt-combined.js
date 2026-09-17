const $r=id=>document.getElementById(id);
const CLASS_RE=/(?:四技|二技|五專|二專|進修(?:部)?|碩士|碩研|博士)[\u3400-\u9fffA-Za-z0-9()（）／/、_-]*?[甲乙丙丁戊己]|技[\u3400-\u9fffA-Za-z0-9]{1,8}?[一二三四五六][甲乙丙丁戊己]|(?:日|夜)?[四二五][\u3400-\u9fffA-Za-z0-9]{1,8}?[一二三四五六][甲乙丙丁戊己]/;
const LOCATION_RE=/(?:樓|館|校區|教室|實驗室|室|場|中心|遠距|線上)/;
const clean=v=>String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();

function maskName(name){
  const chars=Array.from(clean(name));
  if(chars.length<2)return clean(name);
  return `${chars[0]}○${chars.slice(2).join('')}`;
}
function safeSheetName(name,used){
  const base=(clean(name)||'未填老師').replace(/[\\/*?:\[\]]/g,'_').slice(0,31)||'未填老師';
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
  const ps=[...cell.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','p')];
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
  let classIndex=lines.findIndex(x=>CLASS_RE.test(x));
  if(classIndex>=0){
    const classMatch=lines[classIndex].match(CLASS_RE);
    const courseName=clean(lines.slice(0,classIndex).join(' '));
    const after=[clean(lines[classIndex].replace(classMatch?.[0]||'','')),...lines.slice(classIndex+1)].filter(Boolean);
    const teacher=teacherFromAfter(after);
    if(courseName&&classMatch?.[0]&&teacher)return {courseName,className:classMatch[0],teacher};
  }
  const flat=clean(nodeText(cell));
  const cm=flat.match(CLASS_RE);
  if(!cm||!cm.index)return null;
  const courseName=clean(flat.slice(0,cm.index));
  const after=clean(flat.slice(cm.index+cm[0].length));
  let teacher='';
  const tm=after.match(/^([\u3400-\u9fff]{2,4})(?:老師)?/);
  if(tm)teacher=tm[1];
  if(!courseName||!teacher)return null;
  return {courseName,className:cm[0],teacher};
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
  const tables=[...xml.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','tbl')];
  if(!tables.length)throw new Error('找不到課表表格');
  const rows=[...tables[0].getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','tr')];
  const courses=[];const seen=new Set();
  for(const row of rows.slice(1)){
    const cells=[...row.childNodes].filter(n=>n.localName==='tc');
    for(const cell of cells.slice(1)){
      const c=parseCourseCell(cell);if(!c)continue;
      const key=`${c.courseName}|${c.className}|${c.teacher}`;
      if(seen.has(key))continue;seen.add(key);courses.push(c);
    }
  }
  if(!courses.length)throw new Error('找不到可辨識的課程與任課老師');
  return {key:id||name,name,id,studentClass,courses};
}
function border(){return {top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'}};}
function applyCell(cell,{bold=false,center=false,size=11}={}){
  cell.font={name:'標楷體',size,bold};
  cell.alignment={vertical:'middle',horizontal:center?'center':'left',wrapText:true};
  cell.border=border();
}
async function buildCombined(){
  if(!window.ExcelJS||!window.PizZip||!window.saveAs)throw new Error('Excel 或 Word 讀取元件尚未載入，請重新整理後再試');
  const files=[...($r('receiptFiles')?.files||[])];
  if(!files.length)throw new Error('請先選取整理後的 Word 課表');
  const academicYear=clean($r('receiptAcademicYear')?.value);
  const semester=clean($r('receiptSemester')?.value);
  if(!academicYear)throw new Error('請先填寫學年度');
  const parsed=[];const errors=[];
  for(const file of files){try{parsed.push(await parseFile(file));}catch(e){errors.push(`${file.name}：${e.message}`);}}
  if(!parsed.length)throw new Error(errors.join('；')||'沒有可用的課表');
  if(errors.length&&!confirm(`有 ${errors.length} 份課表無法辨識：\n${errors.join('\n')}\n\n是否先用其餘資料產生綜合版？`))return;
  const byTeacher=new Map();
  for(const student of parsed){
    for(const course of student.courses){
      if(!byTeacher.has(course.teacher))byTeacher.set(course.teacher,new Map());
      const byCourse=byTeacher.get(course.teacher);
      const courseKey=`${course.courseName}|${course.className}`;
      if(!byCourse.has(courseKey))byCourse.set(courseKey,{courseName:course.courseName,courseClass:course.className,students:new Map()});
      const group=byCourse.get(courseKey);
      group.students.set(student.key,{name:student.name,studentClass:student.studentClass||course.className});
    }
  }
  const wb=new window.ExcelJS.Workbook();wb.creator='明新科技大學資源教室';
  const used=new Set();
  [...byTeacher.entries()].sort((a,b)=>a[0].localeCompare(b[0],'zh-Hant')).forEach(([teacher,courseMap])=>{
    const ws=wb.addWorksheet(safeSheetName(teacher,used),{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:1,margins:{left:0.3,right:0.3,top:0.4,bottom:0.4,header:0.2,footer:0.2}}});
    ws.mergeCells('A1:E1');ws.getCell('A1').value=`${academicYear}學年度第${semester}學期 ISP 任課教師簽收單（綜合版）`;applyCell(ws.getCell('A1'),{bold:true,center:true,size:14});ws.getRow(1).height=26;
    ws.mergeCells('A2:B2');ws.getCell('A2').value=`任課教師：${teacher}`;applyCell(ws.getCell('A2'),{bold:true,size:12});
    ws.mergeCells('C2:E2');ws.getCell('C2').value='同一位老師之不同課程分區列示，整張僅需簽收一次';applyCell(ws.getCell('C2'),{size:10});
    const headers=['序號','課程名稱／開課班級','學生班級','學生','備註'];
    const hr=ws.addRow(headers);hr.eachCell(c=>applyCell(c,{bold:true,center:true}));
    let no=1;
    for(const group of [...courseMap.values()].sort((a,b)=>a.courseName.localeCompare(b.courseName,'zh-Hant'))){
      const students=[...group.students.values()].sort((a,b)=>`${a.studentClass}${a.name}`.localeCompare(`${b.studentClass}${b.name}`,'zh-Hant'));
      const start=ws.rowCount+1;
      students.forEach((s,idx)=>{
        const row=ws.addRow([no++,idx===0?`${group.courseName}\n（${group.courseClass}）`:'',s.studentClass||'',maskName(s.name),'']);
        row.eachCell(c=>applyCell(c,{center:[1,3,4,5].includes(c.col)}));
      });
      const end=ws.rowCount;
      if(end>start)ws.mergeCells(start,2,end,2);
      ws.getCell(start,2).alignment={vertical:'middle',horizontal:'left',wrapText:true};
    }
    const signRow=ws.rowCount+2;ws.mergeCells(signRow,1,signRow,5);ws.getCell(signRow,1).value='任課教師簽名：____________________________    日期：_______年_______月_______日';applyCell(ws.getCell(signRow,1),{bold:true,size:12});ws.getRow(signRow).height=34;
    ws.columns=[{width:7},{width:30},{width:16},{width:14},{width:16}];
    ws.views=[{state:'frozen',ySplit:3}];
    ws.headerFooter.oddFooter='第 &P / &N 頁';
    ws.pageSetup.printArea=`A1:E${signRow}`;
  });
  const buffer=await wb.xlsx.writeBuffer();
  window.saveAs(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`${academicYear}-${semester}_ISP簽收單_綜合版.xlsx`);
}

function install(){
  const studentBtn=$r('downloadStudentReceiptBtn');
  if(!studentBtn||$r('downloadCombinedReceiptBtn'))return;
  const button=document.createElement('button');button.type='button';button.id='downloadCombinedReceiptBtn';button.className='primary';button.textContent='下載綜合版 Excel（試用）';
  studentBtn.insertAdjacentElement('afterend',button);
  const hint=document.createElement('div');hint.className='timetable-notice';hint.style.marginTop='10px';hint.textContent='綜合版：同一位任課老師只建立一張工作表；老師若有多門課，會在同一張內依課程分區列出學生，最後只簽收一次。';
  button.parentElement?.insertAdjacentElement('afterend',hint);
  button.addEventListener('click',async()=>{const old=button.textContent;button.disabled=true;button.textContent='產生綜合版中…';try{await buildCombined();}catch(e){console.error(e);alert(e.message||'綜合版產生失敗');}finally{button.disabled=false;button.textContent=old;}});
}
install();
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
