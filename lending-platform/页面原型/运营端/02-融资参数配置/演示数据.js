/* Demonstration fixtures only. 虚构演示数据，不连接任何真实配置服务。
   配置对象是组合：区块链网络（按链 ID 区分）+ 代币类型，一个组合一条融资参数配置，只含最高质押率与最长项目期限两项。
   组合只随资产准入审核通过产生，运营不能新增、改名、合并或删除；
   演示工具里的第三个组合用于演示「资产准入通过产生新组合（未配置）」。 */
(function(CF){
  const TYPE='ERC-3525-应收账款';
  const ETH={name:['Ethereum','以太坊'],chainId:'1',icon:'ETH'};
  const SEPOLIA={name:['Ethereum Sepolia','以太坊 Sepolia'],chainId:'11155111',icon:'ETH'};
  const BSC={name:['BNB Smart Chain','BNB Smart Chain'],chainId:'56'};
  const OP='op***@example.com';               // 运营人员按脱敏后的可读归属呈现
  const LI='li***@example.com';

  /* 两项参数的历次取值，按时间正序；每一项都对应一次保存成功。 */
  const HISTORY=[[60,6],[62.5,6],[62.5,9],[65,9],[63.75,9],[66,9],[66,12],[64,12],[68,12],[68,9],[70,9],[67.5,9],
    [67.5,12],[69,12],[71.25,12],[71.25,9],[66,9],[66,12],[72,12],[68,12],[68,10],[70,10],[70,12]];

  function combo(id,network,extra){
    return Object.assign({id,network,tokenType:TYPE,maxRatio:null,maxTermMonths:null,records:[]},extra||{});
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
    return {
      rows:[
        combo('eth-1',ETH,{maxRatio:before.ratio,maxTermMonths:before.term,records:records.slice().reverse()}),
        /* 同一代币类型、不同链 ID：独立的一个组合，刚随资产准入通过产生，尚未配置。 */
        combo('sepolia-11155111',SEPOLIA)
      ],
      now
    };
  };

  /* 资产准入通过产生新组合：以未配置状态出现，配置完成前不可用于创建融资项目。 */
  CF.parameterNewCombo=()=>combo('bsc-56',BSC);
  CF.parameterNewComboId='bsc-56';

})(window.CF=window.CF||{});
