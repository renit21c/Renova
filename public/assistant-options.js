/* The selectable questions are the assistant's public interface. */
(function(root){
  const topics=[
    {id:'finance',label:'Keuangan',icon:'wallet',questions:[
      {id:'overview',label:'Ringkasan',icon:'chart',query:'Ringkasan keuangan',period:true},
      {id:'spending',label:'Pengeluaran',icon:'arrow-out',query:'Pengeluaran',period:true},
      {id:'income',label:'Pemasukan',icon:'arrow-in',query:'Pemasukan',period:true},
      {id:'budget',label:'Anggaran',icon:'target',query:'Anggaran',period:true},
      {id:'control',label:'Perlu dikontrol',icon:'info',query:'Apa yang perlu dikontrol',period:true},
      {id:'balance',label:'Saldo rekening',icon:'wallet',query:'Total saldo rekening'},
    ]},
    {id:'tasks',label:'Tugas',icon:'check',questions:[
      {id:'today',label:'Hari ini',icon:'calendar',query:'Tugas hari ini'},
      {id:'tomorrow',label:'Besok',icon:'chevron-right',query:'Tugas besok'},
      {id:'priority',label:'Prioritas',icon:'target',query:'Apa prioritas yang perlu dikerjakan'},
      {id:'overdue',label:'Terlambat',icon:'info',query:'Tugas terlambat'},
      {id:'unscheduled',label:'Tanpa deadline',icon:'book',query:'Tugas tanpa deadline'},
      {id:'completed',label:'Selesai minggu ini',icon:'check',query:'Tugas selesai minggu ini'},
    ]},
    {id:'schedule',label:'Jadwal',icon:'calendar',questions:[
      {id:'today',label:'Hari ini',icon:'calendar',query:'Jadwal hari ini'},
      {id:'tomorrow',label:'Besok',icon:'chevron-right',query:'Jadwal besok'},
      {id:'week',label:'Minggu ini',icon:'calendar',query:'Jadwal minggu ini'},
      {id:'next-week',label:'Minggu depan',icon:'chevron-right',query:'Jadwal minggu depan'},
      {id:'month',label:'Bulan ini',icon:'calendar',query:'Jadwal bulan ini'},
      {id:'next-month',label:'Bulan depan',icon:'chevron-right',query:'Jadwal bulan depan'},
    ]},
  ];
  const getTopic=id=>topics.find(topic=>topic.id===id);
  function prompt(topicId,questionId,period='current'){
    const topic=getTopic(topicId),question=topic?.questions.find(item=>item.id===questionId);
    if(!question||!['current','previous'].includes(period))return null;
    return{query:question.query+(question.period?(period==='previous'?' bulan lalu':' bulan ini'):''),label:question.label};
  }
  const api={topics,getTopic,prompt};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RenovaAssistantOptions=api;
})(typeof window==='undefined'?globalThis:window);
