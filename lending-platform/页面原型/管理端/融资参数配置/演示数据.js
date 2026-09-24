/* Demonstration fixtures only. 虚构演示数据，不连接任何真实配置服务。
   配置对象是代币类型：一个代币类型一条融资参数配置，只含最高质押率与最长项目期限两项。
   代币类型取值全集由代币发行与同步的上游供给，运营不能新增、改名、合并或删除；
   本期上游只有一个取值，列表只有一行，演示工具里的第二个取值用于演示上游增减。 */
(function(CF){
  const ERC='ERC-20-应收账款';                 // 本期唯一的上游取值
  const TRC='TRC-20-应收账款';                 // 演示上游新增取值时使用，不代表本期已有
  const OP='op***@example.com';               // 运营人员按脱敏后的可读归属呈现
  const LI='li***@example.com';

  /* 两项参数的历次取值，按时间正序；每一项都对应一次保存成功。 */
  const HISTORY=[[60,6],[62,6],[62,9],[65,9],[63,9],[66,9],[66,12],[64,12],[68,12],[68,9],[70,9],[67,9],
    [67,12],[69,12],[71,12],[71,9],[66,9],[66,12],[72,12],[68,12],[68,10],[70,10],[70,12]];

  function token(id,extra){
    return Object.assign({id,name:id,maxRatio:null,maxTermMonths:null,
      updatedAt:null,updatedBy:null,records:[],removed:false},extra||{});
  }

  CF.parameterSeed=function(){
    const now=Date.now(),D=86400000,H=3600000;
    let before={ratio:null,term:null},seq=0;
    const records=HISTORY.map((value,index)=>{
      const record={id:'demo-fc-'+(++seq),at:now-(HISTORY.length-index)*3*D+(index%5)*H,
        by:index%3===0?LI:OP,before,after:{ratio:value[0],term:value[1]},result:'success'};
      before={ratio:value[0],term:value[1]};
      return record;
    });
    const last=records[records.length-1];
    return {
      rows:[token(ERC,{maxRatio:before.ratio,maxTermMonths:before.term,
        updatedAt:last.at,updatedBy:last.by,records:records.slice().reverse()})],
      now
    };
  };

  /* 上游新增取值：以未配置状态出现，配置完成前不可用于创建融资项目。 */
  CF.parameterNewToken=()=>token(TRC);
  CF.parameterTokenNames={erc:ERC,trc:TRC};

  /* 最高质押率的取值上下限与小数位数尚未裁定。以下三组只是占位取值，
     用于演示「超范围拒绝并给出当前允许范围」这一行为，不构成上线口径。 */
  CF.parameterBounds=[
    {key:'a',min:1,max:100,decimals:0},
    {key:'b',min:10,max:80,decimals:1},
    {key:'c',min:50,max:95,decimals:2}
  ];
})(window.CF=window.CF||{});
