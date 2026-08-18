
<map>
  <node ID="root" TEXT="PR-02265 外部做市商新增负手续费率 测试用例">
    <node TEXT="外部做市商费率配置" ID="c6d3e97a96d6fa265742ab2bc409f0ec" STYLE="bubble" POSITION="right">
      <node TEXT="合约/现货交易" ID="bcac5acf95c1a079252c8e901e9e60a7" STYLE="fork">
        <node TEXT="前置： 平台BTCUSDT  taker marker费率均配置 5%，配置A用户BTCUSDT汇率" ID="0111b043e0a21e123678ebad94d18475" STYLE="fork">
          <node TEXT="taker配置1%，maker配置1%" ID="e4bbdc9fad15ab142b23b7e02f3b394b" STYLE="fork">
            <node TEXT="实际交易按照 1%收取手续费" ID="0a6b012a7457e909df3ee730f0ef1bec" STYLE="fork"/>
          </node>
          <node TEXT="taker配置1%，maker配置3%" ID="889721628b9e0fac26ddc7927cf286ea" STYLE="fork">
            <node TEXT="实际交易按照 taker1%，maker 3%收取手续费" ID="f532f6d48c467ced2aa99e5ec23a40ec" STYLE="fork"/>
          </node>
          <node TEXT="taker配置-1%，maker配置3%" ID="9a38f361035a2d0e320b81e7d16f7f9c" STYLE="fork">
            <node TEXT="实际交易按照 taker-1%，maker 3%收取手续费" ID="f1aa18e35c7505c7bb82cbd036ef1e98" STYLE="fork"/>
          </node>
          <node TEXT="taker配置-10%，maker配置-30%" ID="d0bcd3ff8d0571c0023f74a83e2eb36d" STYLE="fork">
            <node TEXT="实际交易按照 taker-10%，maker -30%收取手续费" ID="fbdb7dec42c5ff67cc8c7e83462633b6" STYLE="fork"/>
          </node>
          <node TEXT="taker 配置-111%" ID="bdae728e1b2b242e85ccff1c3df20e94" STYLE="fork">
            <node TEXT="无法配置，区间为0-100" ID="56890a5133b2e7bab62dac906fbb85fe" STYLE="fork"/>
          </node>
          <node TEXT="B用户下单 BTCUSDT" ID="a6e5ef7ba80ad8c67ed980dcb0e22c15" STYLE="fork">
            <node TEXT="实际交易按照平台费率计算" ID="6558626fe396ec03cea32fb0f941c83d" STYLE="fork"/>
          </node>
          <node TEXT="A用户下单 ETHUSDT" ID="c6c3b01ce68fde3bbcb30210450f9394" STYLE="fork">
            <node TEXT="实际交易按照平台费率计算" ID="8a8886b8f15c86cfe84e8ba9bda6dec3" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="前置：外部做市商A已配置 taker费率 -3% ，maker费率-3%" ID="7073f645b792b66dd2d083eb722556a2" STYLE="fork">
          <node TEXT="手续费字段均展示为正数" ID="afeed8e9759372347a26d94fd5733a04" STYLE="fork">
            <node TEXT="合约账户--资金流水：开仓手续费、平仓手续费" ID="1aea554131a04759051eea33000bf49a" STYLE="fork"/>
            <node TEXT="合约交易--资金流水：开仓手续费、平仓手续费" ID="484af559bc4ce31159741b28cd008e0a" STYLE="fork"/>
            <node TEXT="合约交易--历史成交：手续费" ID="7caa5eab49648067459058154a7110fe" STYLE="fork"/>
            <node TEXT="合约交易--仓位历史记录：手续费" ID="9ee3709276c1f3deb2d2505df1e6bb32" STYLE="fork"/>
            <node TEXT="现货管理后台--用户管理：某个用户详情--合约账户--资金流水tab：开仓手续费、平仓手续费" ID="30c111be69a14c48ffef556d64649057" STYLE="fork"/>
            <node TEXT="合约管理后台--数据查询--仓位_已平仓：开平仓手续费字段" ID="fc1eef039785edc153ed42139bafd4e2" STYLE="fork"/>
            <node TEXT="合约管理后台--数据查询--仓位_持仓中：开平仓手续费字段" ID="29bcb0c3f88a7dd865882688202c51e7" STYLE="fork"/>
            <node TEXT="合约管理后台--数据查询--成交记录：真金手续费" ID="6d4a069ebfabbd8e343756c46aa60cf5" STYLE="fork"/>
            <node TEXT="合约管理后台--手续费--用户级别：贡献手续费" ID="521844595ac12858c4ef686dedfbfedf" STYLE="fork"/>
            <node TEXT="合约管理后台--资产--流水查询：开仓手续费、平仓手续费" ID="f78ef2abbce2bea859d51d29ffff2783" STYLE="fork"/>
          </node>
          <node TEXT="返佣" ID="6013b307d481b0b067c72fca012fae45" STYLE="fork">
            <node TEXT="不产生返佣" ID="97c41928b640a7363feeb979badf8bb5" STYLE="fork"/>
          </node>
          <node TEXT="下单类型" ID="2ba5cd48abc49fd3696d33e6a3d8f485" STYLE="fork">
            <node TEXT="全仓" ID="e7ac57c8f8ee138e071a750072f9c65f" STYLE="fork">
              <node TEXT="手续费费率按照 外部做市商A的配置计算" ID="ed4602549b07653cda752f75097bae08" STYLE="fork"/>
            </node>
            <node TEXT="逐仓" ID="6711fd35b3fea0cf8b1a2868a2b53c03" STYLE="fork">
              <node TEXT="手续费费率按照 外部做市商A的配置计算" ID="36b1d14dd084c3ffac6a9b3999f2493b" STYLE="fork"/>
            </node>
            <node TEXT="止盈" ID="b376cf9382b3fcf3601c04de26aa7cc8" STYLE="fork">
              <node TEXT="手续费费率按照 外部做市商A的配置计算" ID="7826203f37510fb5d65403ae1ef1db73" STYLE="fork"/>
            </node>
            <node TEXT="止损" ID="81451004c26e23de353c6454c2b37a28" STYLE="fork">
              <node TEXT="手续费费率按照 外部做市商A的配置计算" ID="1e12df91eb8bb2013843e0abbe1c3d36" STYLE="fork"/>
            </node>
          </node>
          <node TEXT="爆仓" ID="a889e16a7b3e410f5c7e9d0c754e0076" STYLE="fork">
            <node TEXT="实际爆仓价格 应根据负手续费率计算" ID="86f5cb45418e47cc54c7b4d2187448ac" STYLE="fork"/>
            <node TEXT="预估强评价 应根据负手续费率计算" ID="ec429f61414a4e19c2e3a11752b9a11a" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="配置生效" ID="355b35c857d2cede3c1c5e6db6d8e01e" STYLE="fork">
          <node TEXT="一配置即立刻生效，以时间为节点，委托时间在新配置生效之后，都采用新配置费率，不区分仓位开仓时间" ID="3a826768d1345e8fea51cf355709bf89" STYLE="fork"/>
        </node>
      </node>
    </node>
  </node>
</map>