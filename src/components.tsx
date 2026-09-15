import {Bar,Line} from 'react-chartjs-2';import {Chart as ChartJS,CategoryScale,LinearScale,BarElement,PointElement,LineElement,Tooltip,Legend,Filler} from 'chart.js';import type {Series} from './types';import type {ReactNode} from 'react';import {useEffect,useRef,useState} from 'react';import {createPortal} from 'react-dom';import {Filter} from 'lucide-react';
ChartJS.register(CategoryScale,LinearScale,BarElement,PointElement,LineElement,Tooltip,Legend,Filler);
export const money=(n=0,c:'KRW'|'JPY'='KRW')=>new Intl.NumberFormat(c==='KRW'?'ko-KR':'ja-JP',{style:'currency',currency:c,maximumFractionDigits:0}).format(n);
export function KPI({label,value,note}:{label:string;value:string;note?:string}){return <article className="kpi"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</article>}
export function ChartCard({title,series,kind='bar',wide=false,stacked=false,actions}:{title:string;series?:Series;kind?:'bar'|'line';wide?:boolean;stacked?:boolean;actions?:ReactNode}){const empty=!series?.labels?.length;const dual=series?.datasets?.some(d=>d.yAxisID==='y1');const chartOpts=stacked?stackedOpts:dual?dualOpts:opts;return <section className={`card chart-card ${wide?'wide':''}`}><div className="chart-card-head"><h3>{title}</h3>{actions}</div><div className="chart">{empty?<div className="empty">No data returned</div>:kind==='line'?<Line data={series!} options={chartOpts}/>:<Bar data={series!} options={chartOpts}/>}</div></section>}
const opts={responsive:true,maintainAspectRatio:false,interaction:{mode:'index' as const,intersect:false},plugins:{legend:{position:'bottom' as const,labels:{usePointStyle:true,boxWidth:8}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#edf0f4'}}}};
const dualOpts={...opts,scales:{...opts.scales,y1:{beginAtZero:true,position:'right' as const,grid:{drawOnChartArea:false}}}};
const stackedOpts={...opts,scales:{x:{...opts.scales.x,stacked:true},y:{...opts.scales.y,stacked:true}}};
// 범례 클릭으로 드릴다운(카테고리 -> SKU)하고, 범례에 마우스를 올리면 해당 라인만
// 강조되는 라인차트. onLegendClick이 없으면 클릭은 Chart.js 기본 동작(라인 숨기기/보이기)
// 그대로 둔다 - SKU까지 내려간 화면에서는 더 내려갈 데가 없어서 굳이 안 막는다.
export function DrilldownLineChart({title,series,onLegendClick,wide=false,actions}:{title:string;series?:Series;onLegendClick?:(label:string)=>void;wide?:boolean;actions?:ReactNode}){
  const empty=!series?.labels?.length;
  const legend:any={position:'bottom' as const,labels:{usePointStyle:true,boxWidth:8},
    onHover:(_e:unknown,item:any,legendObj:any)=>{const chart=legendObj.chart;chart.data.datasets.forEach((ds:any,i:number)=>{const original=series!.datasets[i]?.borderColor as string;ds.borderColor=i===item.datasetIndex?original:'#d8dbe3';ds.borderWidth=i===item.datasetIndex?3:1.5;});chart.update();},
    onLeave:(_e:unknown,_item:any,legendObj:any)=>{const chart=legendObj.chart;chart.data.datasets.forEach((ds:any,i:number)=>{ds.borderColor=series!.datasets[i]?.borderColor;ds.borderWidth=2;});chart.update();},
  };
  if(onLegendClick)legend.onClick=(_e:unknown,item:any)=>onLegendClick(item.text);
  const chartOpts={...opts,plugins:{legend}};
  return <section className={`card chart-card ${wide?'wide':''}`}><div className="chart-card-head"><h3>{title}</h3>{actions}</div><div className="chart">{empty?<div className="empty">No data returned</div>:<Line data={series!} options={chartOpts}/>}</div></section>;
}
export function DataTable({title,rows,scroll=false,actions}:{title:string;rows?:Record<string,string|number>[];scroll?:boolean;actions?:ReactNode}){const keys=rows?.length?Object.keys(rows[0]):[];return <section className={`card wide ${scroll?'daily-table':''}`}><div className="chart-card-head"><h3>{title}</h3>{actions}</div>{!rows?.length?<div className="empty">No data returned</div>:<div className="table-wrap"><table><thead><tr>{keys.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{keys.map(k=><td key={k}>{r[k]}</td>)}</tr>)}</tbody></table></div>}</section>}
// 엑셀 시트처럼 컬럼 헤더를 클릭하면 그 컬럼에 나오는 값들을 체크박스로
// 선택/해제할 수 있는 필터 팝오버. selected가 null이면 "전체 선택" 상태.
// 팝오버는 테이블의 overflow:auto 스크롤 영역에 잘리지 않도록 body에 포탈로 띄운다.
function ColumnFilterHeader({label,options,selected,onChange}:{label:string;options:string[];selected:Set<string>|null;onChange:(s:Set<string>|null)=>void}){
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [pos,setPos]=useState({top:0,left:0});
  const thRef=useRef<HTMLTableCellElement>(null);
  const popRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(open)setQuery('');
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const onOutside=(e:MouseEvent)=>{
      if(thRef.current?.contains(e.target as Node))return;
      if(popRef.current?.contains(e.target as Node))return;
      setOpen(false);
    };
    const onScroll=()=>setOpen(false);
    document.addEventListener('mousedown',onOutside);
    window.addEventListener('scroll',onScroll,true);
    return ()=>{document.removeEventListener('mousedown',onOutside);window.removeEventListener('scroll',onScroll,true);};
  },[open]);
  const active=selected!==null;
  const isChecked=(v:string)=>selected===null||selected.has(v);
  const toggle=(v:string)=>{
    const next=selected===null?new Set(options):new Set(selected);
    if(next.has(v))next.delete(v);else next.add(v);
    onChange(next.size===options.length?null:next);
  };
  const filtered=options.filter(o=>o.toLowerCase().includes(query.toLowerCase()));
  const openPopover=()=>{
    const rect=thRef.current?.getBoundingClientRect();
    if(rect)setPos({top:rect.bottom+4,left:rect.left});
    setOpen(o=>!o);
  };
  return (
    <th ref={thRef} className="filter-th">
      <div className="filter-th-head" onClick={openPopover}>
        <span>{label}</span>
        <Filter size={12} className={active?'filter-icon active':'filter-icon'} />
      </div>
      {open&&createPortal(
        <div className="filter-popover" style={{top:pos.top,left:pos.left}} ref={popRef}>
          <input className="filter-search" placeholder="검색..." value={query} onChange={(e)=>setQuery(e.target.value)} />
          <div className="filter-popover-actions">
            <button onClick={()=>onChange(null)}>전체 선택</button>
            <button onClick={()=>onChange(new Set())}>전체 해제</button>
          </div>
          <div className="filter-popover-list">
            {filtered.map((v)=>(
              <label key={v}>
                <input type="checkbox" checked={isChecked(v)} onChange={()=>toggle(v)} />
                <span>{v}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </th>
  );
}
export function ProductRankTable({title,rows,actions,lineOptions,lineSelected,onLineChange,productOptions,productSelected,onProductChange}:{
  title:string;
  rows:{rank:number;line:string;product:string;quantity:number}[];
  actions?:ReactNode;
  lineOptions:string[];lineSelected:Set<string>|null;onLineChange:(s:Set<string>|null)=>void;
  productOptions:string[];productSelected:Set<string>|null;onProductChange:(s:Set<string>|null)=>void;
}){
  return (
    <section className="card wide">
      <div className="chart-card-head"><h3>{title}</h3>{actions}</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>rank</th>
              <ColumnFilterHeader label="line" options={lineOptions} selected={lineSelected} onChange={onLineChange} />
              <ColumnFilterHeader label="product" options={productOptions} selected={productSelected} onChange={onProductChange} />
              <th>quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length?rows.map((r)=>(
              <tr key={r.rank}><td>{r.rank}</td><td>{r.line}</td><td>{r.product}</td><td>{r.quantity}</td></tr>
            )):(
              <tr><td colSpan={4} className="empty-row">필터에 해당하는 데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
