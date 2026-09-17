const GRADE_OPTIONS=[
  ["","請選擇"],
  ["一","一年級"],["二","二年級"],["三","三年級"],["四","四年級"],
  ["五","五年級"],["六","六年級"],["七","七年級"],["八","八年級"],
  ["研一","研一"],["研二","研二"]
];

function ensureSemesterGradeOptions(){
  const select=document.querySelector('#semesterIspForm select[name="studentGrade"]');
  if(!select)return;
  const current=select.value;
  const expected=GRADE_OPTIONS.map(([value])=>value).join('|');
  const actual=[...select.options].map(o=>o.value).join('|');
  if(actual!==expected){
    select.innerHTML=GRADE_OPTIONS.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
    if(GRADE_OPTIONS.some(([value])=>value===current))select.value=current;
  }
}

ensureSemesterGradeOptions();
new MutationObserver(()=>ensureSemesterGradeOptions()).observe(document.body,{childList:true,subtree:true});

document.addEventListener('focusin',event=>{
  if(event.target?.matches?.('#semesterIspForm select[name="studentGrade"]'))ensureSemesterGradeOptions();
});

console.log('Semester ISP grade options: 1-8 + graduate loaded');
