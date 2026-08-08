
<map>
  <node ID="root" TEXT="PR-01988预测市场二期测试用例">
    <node TEXT="前端埋点" ID="92c1c0333e10406df070dae97df47b88" STYLE="bubble" POSITION="right">
      <node TEXT="P0列表曝光埋点上报" ID="901e2503b4613034291bc3c931c11ba9" STYLE="fork">
        <node TEXT="预测时间列表页曝光" ID="d8964d2424b1da21de49e1fd2c0b4196" STYLE="fork">
          <node TEXT="进入预测市场事件列表页" ID="f10cb730bebff1662057af972113660c" STYLE="fork">
            <node TEXT="打开预测时间列表页，抓取埋点请求" ID="a0d3f65e67251d1377d46234df069e35" STYLE="fork">
              <node TEXT="预期结果" ID="67d6806e24bcb93ce6cc1add73c5b01f" STYLE="fork">
                <node TEXT="成功上报 polymarket_list_expose" ID="1d3233a6c4721f6ace2e6d8d3a3269f0" STYLE="fork"/>
                <node TEXT="包含 first_level_tab、second_level_tab" ID="4f9fb0c7ceccb6995796c7d27ddfb121" STYLE="fork"/>
                <node TEXT="公共字段包含 uid/device_id、source、channel、ts" ID="fb8bd3fba0bf16868f3986c1e802b29c" STYLE="fork"/>
              </node>
            </node>
          </node>
          <node TEXT="事件点击埋点" ID="b50722ad1bd6b540e2ffad8c96a53700" STYLE="fork">
            <node TEXT="点击任一预测事件进入详情页，检查埋点" ID="75120305248a5a81ce8cb5d6aa712ed8" STYLE="fork">
              <node TEXT="预期结果" ID="60d5162377aa7d6bdccb19cbab1cc2e2" STYLE="fork">
                <node TEXT="上报 polymarket_event_click" ID="7dd4072546d0b271542963cc061be118" STYLE="fork"/>
                <node TEXT="参数包含 event_id、event_slug、market_id" ID="3f6767f3fb3614701abaf02e80dd995d" STYLE="fork"/>
              </node>
            </node>
          </node>
          <node TEXT="买入提交埋点" ID="3fd06e1015d866e9621a782e8408470a" STYLE="fork">
            <node TEXT="在详情页输入下注金额，选择yes/no，点击买入" ID="731d7eee5a4af2b5412f40b21263257e" STYLE="fork">
              <node TEXT="预期结果" ID="bdea3ae7578ee695384b4e970f8e06ee" STYLE="fork">
                <node TEXT="上报 polymarket_buy_submit" ID="907d0d6bb30b3db274f3c5799b3d63e0" STYLE="fork"/>
                <node TEXT="参数包含 event_id/event_slug/market_id/amount/direction" ID="39251b4cb7708af0723477e6bcdd3989" STYLE="fork"/>
                <node TEXT="amount 为用户实际下注金额" ID="17ae66c71ac4e68ecb25416f7bca901b" STYLE="fork"/>
              </node>
            </node>
          </node>
          <node TEXT="买入结果埋点(成功)" ID="74a9bbb2a27ea4a31aa6125fed98a6f1" STYLE="fork">
            <node TEXT="完成一笔买入成功订单，检查前端/后端埋点" ID="e40d20cd94d9bbd1dc44b3034943270e" STYLE="fork">
              <node TEXT="预期结果" ID="b214ffa77151d6edd1ec1cfec293c49a" STYLE="fork">
                <node TEXT="上报 polymarket_buy_result" ID="1f39657cf997d41d37e03bc5b3878763" STYLE="fork"/>
                <node TEXT="status=成功" ID="540de25d0df0a699a1637b995569dbee" STYLE="fork"/>
                <node TEXT="字段包含 event_id/event_slug/market_id/amount/direction" ID="8ff50f971ff248aeb12371702a0b83a0" STYLE="fork"/>
                <node TEXT="若方案已落地手续费字段，则上报 pm_fee_actual" ID="e43103679bb9ca72e2da494db38aab4c" STYLE="fork"/>
              </node>
            </node>
          </node>
          <node TEXT="买入结果埋点（失败）" ID="2077e8276ff13e0b630ef04113c7a5e8" STYLE="fork">
            <node TEXT="构造下单失败场景（余额不足/交易关闭/链路异常）" ID="949db69ac0bcd8ac1654c42a850644bf" STYLE="fork">
              <node TEXT="预期结果" ID="e76aecafb609799d0f6579f9d4fb888a" STYLE="fork">
                <node TEXT="上报 polymarket_buy_result" ID="c4c44a760a5420db9a14fe904a38a92c" STYLE="fork"/>
                <node TEXT="status=失败" ID="725efad9a7199a3009f2255a4b28b3e6" STYLE="fork"/>
                <node TEXT="失败订单与订单表状态一致" ID="31fc1f2c0ddea70d607af02508b8459b" STYLE="fork"/>
              </node>
            </node>
          </node>
          <node TEXT="卖出提交埋点" ID="7edfde9618580a255aea6898696acb0a" STYLE="fork">
            <node TEXT="逻辑同买入，对应事件分别为 polymarket_sell_submit / polymarket_sell_result" ID="4deede76ebed069ad66514007448b227" STYLE="fork"/>
          </node>
          <node TEXT="卖出结果埋点（成功）" ID="f17d2116f2a87414c7b3c5783040e8bc" STYLE="fork">
            <node TEXT="逻辑同买入，对应事件分别为 polymarket_sell_submit / polymarket_sell_result" ID="ecc07b082b23b5c06e1e742252351290" STYLE="fork"/>
          </node>
          <node TEXT="卖出结果埋点（失败）" ID="cc912de66b5ecc1ae2beac48dbc71246" STYLE="fork">
            <node TEXT="逻辑同买入，对应事件分别为 polymarket_sell_submit / polymarket_sell_result" ID="e1c08632bcc63f71e8f6de25f726526f" STYLE="fork"/>
          </node>
          <node TEXT="FAQ 点击埋点" ID="1ae9e59d0662118676bd9e84afc0149f" STYLE="fork">
            <node TEXT="点击常见问题" ID="999b8c0004087f5b934ca821ccb9b397" STYLE="fork">
              <node TEXT="预期结果：上报 polymarket_faq_click" ID="71ecc2ffa7d3a00744c41d1c7ed50810" STYLE="fork">
                <node TEXT="P2" ID="8a5db72708fbd7d70c7c68b659c65506" STYLE="fork"/>
              </node>
            </node>
          </node>
          <node TEXT="结算结果埋点" ID="5cdf3fdd45c6cd556043e465449c4730" STYLE="fork">
            <node TEXT="触发事件结算" ID="e3b4c45d5dd8b768ef9f1e18597dca66" STYLE="fork">
              <node TEXT="预期结果" ID="34f760590893af858415c70a1a63958a" STYLE="fork">
                <node TEXT="上报 polymarket_settle" ID="d865dd84ab4d1deef09f5c942e7391cd" STYLE="fork"/>
                <node TEXT="包含 event_id/event_slug/market_id/direction/win_loss/amount" ID="3d9a17583750f99ac105dbafd7082d53" STYLE="fork"/>
              </node>
            </node>
          </node>
          <node TEXT="埋点公共字段校验" ID="ccfe18b07c5147506797c28f7bf0b2d7" STYLE="fork">
            <node TEXT="预期结果" ID="1b74c5d38cc43cc6f20a293fcdb2efca" STYLE="fork">
              <node TEXT="所有埋点都带公共字段：uid / device_id、event_id、direction、source、channel、ts" ID="2d4db7aa0126e2943f9f6b32df65416a" STYLE="fork"/>
              <node TEXT="资金类事件带 amount/shares/markup_rate/order_id/hash/status" ID="f3ef4dace045bbfdab2bc11d3d02a7e0" STYLE="fork"/>
            </node>
          </node>
          <node TEXT="服务端结果事件与订单一致性" ID="94e3d99821c676128c5c1a6eb2209d83" STYLE="fork">
            <node TEXT="抽取一笔成功买入/卖出/结算订单" ID="00ec5a17be4dd9ed5b0be3553489dc5a" STYLE="fork">
              <node TEXT="预期结果" ID="bbba62ac235af1727d2cf6fbfda763db" STYLE="fork">
                <node TEXT="埋点中的订单状态、金额、方向与订单表一致" ID="38f14cf7bbb9e54e1f1c9ce6f5d82e1a" STYLE="fork"/>
                <node TEXT="服务端结果事件与订单数据一致率 100%" ID="86975e97699b7828dad0c187d37dd62d" STYLE="fork"/>
              </node>
            </node>
          </node>
        </node>
      </node>
    </node>
    <node TEXT="每日收入统计" ID="235e564d0e17dd3a4e3319a339fcb24f" STYLE="bubble" POSITION="right">
      <node TEXT="数据查询与页面展示" ID="7ea028b0355c49a8527122eba32cb888" STYLE="fork">
        <node TEXT="进入“预测市场管理-每日收入统计”" ID="a851d00034ae3a4ff4f4b3a1fea3a438" STYLE="fork">
          <node TEXT="预期结果" ID="071db99dd667f8cb41119ba80b80cc1d" STYLE="fork">
            <node TEXT="页面正常展示 KPI 卡、毛利趋势图、每日明细表" ID="3614850db754fda16aad96ef05e8de75" STYLE="fork"/>
            <node TEXT="默认时间范围符合产品定义（若无定义则确认默认近7日）" ID="c557952ecfb6d78493f0499e07b6f3af" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="时间筛选-近7日" ID="2fb576b3b1ee0902f6bdd1d99f1dfc57" STYLE="fork">
          <node TEXT="预期结果" ID="8523e215410e280e1c3a948e8c982e00" STYLE="fork">
            <node TEXT="统计按 UTC+8 自然日聚合" ID="7bf1e7495208a0c6c840f6412a8dc8cb" STYLE="fork"/>
            <node TEXT="明细仅展示近7日数据" ID="b2321696eb2ed13d20525f338aaedbc2" STYLE="fork"/>
            <node TEXT="汇总卡片、趋势图、表格同步刷新" ID="40dd8c7dcadcdf660a604321a09b4913" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="时间筛选-近15日" ID="05472314c07c448b703fb65564088495" STYLE="fork">
          <node TEXT="预期结果：区间正确、数据刷新正确、导出区间一致" ID="8b80997072a154308a0c3a9805b1876a" STYLE="fork"/>
        </node>
        <node TEXT="时间筛选-近30日" ID="68fe13c5d4913a9bbbe58694682d0d61" STYLE="fork">
          <node TEXT="预期结果：区间正确、数据刷新正确、导出区间一致" ID="e4393d34da0052e689171a8814f2c638" STYLE="fork"/>
        </node>
        <node TEXT="时间筛选-自定义区间" ID="556c9503487cfe30c060d12f6cb1ea17" STYLE="fork">
          <node TEXT="预期结果：区间正确、数据刷新正确、导出区间一致" ID="c1d99b3743542121055084f7e0b65870" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="收入计算" ID="8aa589bc7d8c8abcc6d7a1777ee327ba" STYLE="fork">
        <node TEXT="买入加价收入汇总正确" ID="63420f1837ffbeb8afd9ac66ad264743" STYLE="fork">
          <node TEXT="存在多笔买入订单，按测试数据准备 3 笔买入订单，查询统计页对应日期" ID="7165bfa595b479f64119fbb8fbb0ff44" STYLE="fork">
            <node TEXT="预期结果" ID="6aa102d4e2df37a3e622db7e0a3321cf" STYLE="fork">
              <node TEXT="买入加价收入 = Σ 单笔买入加价收入" ID="d643609717a2aa69728d01271e179fd0" STYLE="fork"/>
              <node TEXT="与订单逐笔核算一致" ID="d2f396c0ce9150c8def35b5c9636b848" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="卖出抽水收入汇总正确" ID="88e476a6015f7e25a5c38452a05de841" STYLE="fork">
          <node TEXT="预期结果" ID="c627e315d9de64b9ad334696ff4a5ba1" STYLE="fork">
            <node TEXT="卖出抽水收入 = Σ 卖出订单抽水收入" ID="15d72680d9e29fdb8c74b3ee7f8f3f79" STYLE="fork"/>
            <node TEXT="链上卖出 ≤ 1U 的订单豁免，不计入卖出抽水" ID="2c2c1c27f2b06a545ec399de80a862b1" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="结算抽水收入汇总正确" ID="2d605368dead2b2de065fee849304656" STYLE="fork">
          <node TEXT="预期结果" ID="38a9859a6da2f4c5120d13d6e7a368ba" STYLE="fork">
            <node TEXT="仅盈利结算订单计入结算抽水收入" ID="20c19d48e4f629cc18b94b8f3550a7fb" STYLE="fork"/>
            <node TEXT="亏损结算订单不计入结算抽水" ID="2be864b86059b2ee5d2da455acfc2943" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="PM 手续费取成交回执实际值" ID="7f0d4d9afb0661e5877ede7bdbf7906c" STYLE="fork">
          <node TEXT="准备多笔成交记录，包含 pm_fee_actual，查询统计页" ID="bae771b128548ff3ddc97e50f7a4a4d3" STYLE="fork">
            <node TEXT="PM 手续费 = Σ pm_fee_actual" ID="a1998c5f87a2ec2c554b99b64b7f1360" STYLE="fork"/>
            <node TEXT="不使用“成交额×费率”估算" ID="0355059784a3185dce9e946aaecb9a1a" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="Gas 成本统计正确" ID="3d7cc5680e6bffe0f458adafd3ab63d6" STYLE="fork">
          <node TEXT="预期结果" ID="2efc0348661b24213e10c452a4e657c6" STYLE="fork">
            <node TEXT="Gas 按逐笔交易实际 Gas 折算 USDT 累加" ID="b404902b3abbdd6b67ae64b717f35f85" STYLE="fork"/>
            <node TEXT="无 Gas 时显示 0 或空，符合产品定义" ID="6c995969393901706e9a601b6a447ef4" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="毛利计算正确" ID="77f3b49710908eeb96c3fead48651955" STYLE="fork">
          <node TEXT="预期结果" ID="5c3c71740f64a3a355a71671250a651b" STYLE="fork">
            <node TEXT="毛利 = (Σ买入加价收入 + Σ卖出抽水收入 + Σ结算抽水收入) " ID="8d2e703825f548ef17ca60e15623673e" STYLE="fork"/>
            <node TEXT="若系统实现包含成本扣减，则需按最终落地口径校验页面字段与财务口径一致" ID="82002e04d43efdb6f41c9449d5f4b620" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="汇总卡占比计算正确" ID="880dac26f25846ba436f6dff19dab510" STYLE="fork">
          <node TEXT="预期结果" ID="5b88e9f6ba168de858bd79c8c9c19f6a" STYLE="fork">
            <node TEXT="买入/卖出/结算收入占比 = 对应收入 / 总收入" ID="cb4b68fc85e94e6c9ec33ad11751aa87" STYLE="fork"/>
            <node TEXT="四舍五入保留两位小数" ID="fd6356c0c21a2a05a854518a85f76732" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="每日明细字段展示正确" ID="f763541ddc3d82ae6e9bfa9fbaa707e8" STYLE="fork">
          <node TEXT="明细包含" ID="e9cd1e2b058a039ca2973eae05dc0ad5" STYLE="fork">
            <node TEXT="日期" ID="098107e7d50f2d29eed3c2373a173d0b" STYLE="fork"/>
            <node TEXT="订单数" ID="3fd1388f00a06484ea3911e947c182e0" STYLE="fork"/>
            <node TEXT="成交额" ID="4910cd5a577ee85182e9c84ab686db3e" STYLE="fork"/>
            <node TEXT="买入加价" ID="c0ac63efc14c9d17adf037eb31e557a7" STYLE="fork"/>
            <node TEXT="卖出抽水" ID="827c1dfd7f99b59582144ef089039c76" STYLE="fork"/>
            <node TEXT="结算抽水" ID="832663174d41cf48e7ea6a134068602e" STYLE="fork"/>
            <node TEXT="PM 手续费" ID="bc52556c4130f51bd74559d065d4ffc8" STYLE="fork"/>
            <node TEXT="Gas" ID="1428559e9ffb32e3dc4071f4a3c38b37" STYLE="fork"/>
            <node TEXT="毛利" ID="7adb5d03456c99d69c6eb7b2aac92d1b" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="订单数汇总正确" ID="8e328f45dbbb6df9ee556eaa7fe83f1a" STYLE="fork">
          <node TEXT="预期结果" ID="6bed5d924320dead8c5bc803a464fa50" STYLE="fork">
            <node TEXT="汇总订单数 = 买入 + 卖出 + 结算订单数" ID="58bd40a4d05101f483da703d17c43516" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="成交额汇总正确" ID="0fb89359b7b5d3ca845ab1549dd59913" STYLE="fork">
          <node TEXT="预期结果" ID="fc39b2f9c1fb1b450cf5bc9c53402535" STYLE="fork">
            <node TEXT="成交额 = 买入成交额 + 卖出成交额" ID="90c3c314c81a446138006016fc688df7" STYLE="fork"/>
            <node TEXT="买入成交额 = 买入份额 × 单价" ID="58ff9ec468f2587524b9ee80757510c7" STYLE="fork"/>
            <node TEXT="卖出成交额 = 卖出份额 × 单价" ID="04ea486803b7bab46e488fbc0dfb86f2" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="导出 CSV 成功" ID="4a803d4bd8a7ad3410b2e8cb2fe5ad9b" STYLE="fork">
          <node TEXT="选择时间区间后点击导出" ID="fdb72f850708d161508bb452b6f81eb9" STYLE="fork">
            <node TEXT="预期结果" ID="4c3df7fe47af23795accc350a9db41ac" STYLE="fork">
              <node TEXT="成功下载 CSV" ID="181080062c2df401ca091d758cc9507b" STYLE="fork"/>
              <node TEXT="数据与当前筛选结果一致" ID="a5a9baac5c3a3c293dff8b65166f8601" STYLE="fork"/>
              <node TEXT="数值精度正确" ID="9f971094649651cf592d84952650561d" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="空数据日期展示" ID="9e1a2e1f4f6002dcecf2e15eb95c251b" STYLE="fork">
          <node TEXT="预期结果" ID="aa6309e0a58bf7d81ec0d2fc524668a4" STYLE="fork">
            <node TEXT="无数据日期可展示 0 或空，符合设计" ID="d4abc8dd6c1c6781e32668d84f7bc5b6" STYLE="fork"/>
            <node TEXT="页面不报错" ID="23b06e3248c25c23aff1d8b75bd85d0c" STYLE="fork"/>
          </node>
        </node>
      </node>
    </node>
    <node TEXT="通用参数管理" ID="1ab61b072e6675a79f085074130b123e" STYLE="bubble" POSITION="right">
      <node TEXT="查看默认参数" ID="6e0f0a6f7b9b3579f6c036505dd1f96c" STYLE="fork">
        <node TEXT="预期结果" ID="8410b6e02e47bb61bb0cca4bc786bc7b" STYLE="fork">
          <node TEXT="展示买入/卖出/结算 rate 当前值" ID="943643a359ed70310e4bc220e915fe9b" STYLE="fork">
            <node TEXT="P1" ID="1bb09e33a3a823f6e2467ce47551dd66" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="修改买入 rate 成功" ID="51127c6e1936d1b54a84960034b0971a" STYLE="fork">
        <node TEXT="点击修改，输入合法买入rate，点击保存" ID="a19289c5b7a935536d9264a4cf0b66c4" STYLE="fork">
          <node TEXT="预期结果" ID="2fd908dfeb1d0852f2ebc822a552676f" STYLE="fork">
            <node TEXT="页面展示新值" ID="822cf520c19eca8ec2cf8854a5a69d5a" STYLE="fork"/>
            <node TEXT="保存成功" ID="1cd44961f01b069178b07e6ec1510865" STYLE="fork">
              <node TEXT="P0" ID="f1aea003cebaee5d27e8716c2803b11e" STYLE="fork"/>
            </node>
            <node TEXT="新值对后续新订单生效" ID="e6007936dabcb6507f45cec08c890467" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="修改卖出 rate 成功" ID="c2f37f46b68cc3d93d0cff9149617000" STYLE="fork">
        <node TEXT="点击修改，输入合法买入rate，点击保存" ID="70166cc0ceed955ce87ef69f5239fe96" STYLE="fork">
          <node TEXT="预期结果" ID="ee225ca3b5ea513b14c8fcea7ab64aa2" STYLE="fork">
            <node TEXT="保存成功" ID="e617adce52f15808efc6f93e335c8105" STYLE="fork"/>
            <node TEXT="页面展示新值" ID="2091a261408fb33fcae766fd86e47097" STYLE="fork"/>
            <node TEXT="新值对后续新订单生效" ID="39b72e387085475e7ee8ba2d100a3f47" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="修改结算 rate 成功" ID="347c5dd584e82ddce76e298f9a219f36" STYLE="fork">
        <node TEXT="点击修改，输入合法买入rate，点击保存" ID="1f7d72bee2891db8e88eb188fca09b9e" STYLE="fork">
          <node TEXT="预期结果" ID="d80447d560742df9dd69c2853ab4e950" STYLE="fork">
            <node TEXT="保存成功" ID="314a62c84fabf94356d4caf703beba14" STYLE="fork"/>
            <node TEXT="页面展示新值" ID="be689989c3000c3881211bece7e7f378" STYLE="fork"/>
            <node TEXT="新值对后续新订单生效" ID="39e72eab86bfd326949d13f477c685a6" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="rate 未填写保存失败" ID="75e66a729ef5ee324a0dd8c08bea50ef" STYLE="fork">
        <node TEXT="预期结果" ID="9345402f16d150cd92a4118b874d4031" STYLE="fork">
          <node TEXT="保存失败" ID="1894b44d2e3e3c3038c25195e7ecf6a6" STYLE="fork"/>
          <node TEXT="提示“请填写参数”" ID="27f34d81fd69decfadc471b88c638598" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="输入非法格式" ID="1b89c33c4b4e653de2bde6a0915e94d6" STYLE="fork">
        <node TEXT="输入非数字/负数/超长小数" ID="334f863c3a14f2be3556abdf8921e97e" STYLE="fork">
          <node TEXT="预期结果" ID="067fb11c1886d8a8294029636341b3a3" STYLE="fork">
            <node TEXT="拦截非法输入" ID="3cd253ff64c05762a670ad267b4fda8d" STYLE="fork"/>
            <node TEXT="给出明确提示" ID="467f05043e9fc913bcf75b85f3bfb81d" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="边界值校验" ID="7ed0f67449c0e8e79fb0155e2e2f2234" STYLE="fork">
        <node TEXT="0、0.0001、极大值、超精度值" ID="bed71b15a239b5f960f7bc25c1e30137" STYLE="fork">
          <node TEXT="预期结果" ID="5a57e633166192935cf9b03b72d16b9c" STYLE="fork">
            <node TEXT="按产品定义保留合法精度" ID="556c3aeb2db8d9b0019e96e9d2b52fd3" STYLE="fork"/>
            <node TEXT="超出精度或范围时报错" ID="f19b4dc77f80a272c5bbc1285d003dfc" STYLE="fork"/>
          </node>
        </node>
      </node>
    </node>
    <node TEXT="分类管理" ID="aa50a4b80b7ba5108961beffd0458be7" STYLE="bubble" POSITION="right">
      <node TEXT="创建一级分类成功" ID="3e05529f81cc22c092d10235dd5ba077" STYLE="fork">
        <node TEXT="点击创建一级分类，输入英文名称，点击保存" ID="474f225171f9ffe3b1611b50a372e57c" STYLE="fork">
          <node TEXT="预期结果" ID="ba23256dbe17617cb47d31784e9d7804" STYLE="fork">
            <node TEXT="创建成功" ID="9e306efb4b59d8376fca407ff531153d" STYLE="fork"/>
            <node TEXT="列表新增该分类" ID="03db4002a9bf5c1d548b96a51cf0f56e" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="一级分类英文名为空" ID="e26d313411873893d9bc18c9d0dcc3d2" STYLE="fork">
        <node TEXT="预期结果" ID="ed5fe615f83862ac74178fd00557d03c" STYLE="fork">
          <node TEXT="保存失败" ID="7fb2406dc0c6c2bc338e94ccdde19f31" STYLE="fork"/>
          <node TEXT="提示“请填写英文名称”" ID="4967e3fce098448c4f7b0a3f7fa6a4e1" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="一级分类多语言未填写" ID="51d3914ec80ec8b37154e6df1d9dd2a2" STYLE="fork">
        <node TEXT="预期结果" ID="3af9ba97059157bf3a4aecd19091a283" STYLE="fork">
          <node TEXT="保存成功" ID="c5e3673513b6e1d9df5ad28fe35bef18" STYLE="fork"/>
          <node TEXT="未配置语言回退英文" ID="3aa967df921c8abaa896cbdab9ac9a01" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="修改一级分类成功" ID="c23b443a48979494995101f54a3e4b39" STYLE="fork">
        <node TEXT="点击创建一级分类，输入英文名称，点击保存" ID="451843f94cc45c20d0360e3bc090eb21" STYLE="fork">
          <node TEXT="预期结果" ID="c0421546b18789adb018b326e9664c36" STYLE="fork">
            <node TEXT="修改成功，名称更新" ID="494764d6a9339b98a719676bf0de348c" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="删除一级分类成功" ID="f0e63c3c2ebd97206675669ce3dcf529" STYLE="fork">
        <node TEXT="预期结果" ID="5bae39e5184f024fff6ee9704c3a7ab4" STYLE="fork">
          <node TEXT="删除前弹二次确认；确认后删除" ID="6968cb98e9844f93e8381cfc3717b5f8" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="创建二级分类成功" ID="a5729db568af429a59b7621f9e7ffa14" STYLE="fork">
        <node TEXT="点击创建二级分类，输入英文名称 ，点击保存" ID="ed60f6a257385cefebc06e810f6fb5cd" STYLE="fork">
          <node TEXT="预期结果" ID="0240c96a96d1052cc12d96bc1b1aa33f" STYLE="fork">
            <node TEXT="创建成功" ID="55fdab3de276480e125091b1ff983fa7" STYLE="fork"/>
            <node TEXT="列表新增二级分类" ID="629f53a34d76b46382c0eae18ac3039a" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="创建三级分类成功" ID="e0e000da3dc4585ea8b3d264652b69f9" STYLE="fork">
        <node TEXT="点击创建三级分类，输入英文名称 ，点击保存" ID="424cd1de0a4e03d1bb96c240ebcd09ca" STYLE="fork">
          <node TEXT="预期结果" ID="bd72642d68b2edb569a55c5d1072e26a" STYLE="fork">
            <node TEXT="创建成功" ID="d23efb6d54de3c540df5e007011d5280" STYLE="fork"/>
            <node TEXT="列表新增二级分类" ID="90bcf4cdd67e01c9e85b4dec094daece" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="删除二级分类时级联删除三级分类" ID="c55d263f29515d3710bda03d1c9d2fc3" STYLE="fork">
        <node TEXT="预期结果" ID="9280ff2eb4e7896f9f1950801e28d6e4" STYLE="fork">
          <node TEXT="删除前弹二次确认；确认后删除" ID="0ac18201dc59be1e2b1a892f7b3888ea" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="二/三级分类英文名为空" ID="cac0398a622d980996a67fa241cb8a93" STYLE="fork">
        <node TEXT="预期结果" ID="bea7ffdcececf333d76c8e89fe398ee8" STYLE="fork">
          <node TEXT="输入框变红" ID="050fd38fca0314d2543a5e8862305205" STYLE="fork"/>
          <node TEXT="提示“英文为必填项”" ID="8222da91b44dd603232f3d3764c88a88" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="二/三级分类多语言配置" ID="a0098600c6463c180c67fc8632581710" STYLE="fork">
        <node TEXT="预期结果" ID="69f99d403cff654e232dcfa2c91b3c78" STYLE="fork">
          <node TEXT="支持配置所有语言" ID="384832cac54e5cfd03f97e3a2dbe7ed1" STYLE="fork"/>
          <node TEXT="未填写时回退英文" ID="c63d2ede5c1dc6c0406c0b2650135c2c" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="拖拽排序生效" ID="686e7465998159f16e5b36187947f315" STYLE="fork">
        <node TEXT="拖动二级或三级分类顺序" ID="d9f44c676f683139b7a70066a9b0d433" STYLE="fork">
          <node TEXT="预期结果" ID="9dc7970a50ac7fe1f6d4518325ad2a90" STYLE="fork">
            <node TEXT="列表顺序更新" ID="ea734a9b01f4f14b89832f448743702b" STYLE="fork"/>
            <node TEXT="前端对应分类顺序同步" ID="568d6c78380e2a04873ebd3df5d0d1d9" STYLE="fork"/>
          </node>
        </node>
      </node>
    </node>
    <node TEXT="事件管理" ID="66655dba7b1a0f45b0b9b0f5bd783ffb" STYLE="bubble" POSITION="right">
      <node TEXT="通过 Event ID 添加事件成功" ID="135300ea0974db9391c95f19fbe0a97a" STYLE="fork">
        <node TEXT="点击“添加事件”，选择 ID 搜索，输入合法 Event ID，点击确认搜索" ID="2a8af2e3bf1cac56e6334d5d3312ee0c" STYLE="fork">
          <node TEXT="预期结果" ID="5ab2035902fb7a4526e016cdf2965bbd" STYLE="fork">
            <node TEXT="成功拉取事件信息" ID="cacb5aa31fa71a09d9b39e1a589db1a2" STYLE="fork"/>
            <node TEXT="展示 title / 类型 / slug / 分类" ID="ced8e6865ec4938cc0d59af146f7a5c1" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="通过 Slug 添加事件成功" ID="c350de7e5c816091293c8a63359cfbfa" STYLE="fork">
        <node TEXT="点击“添加事件”" ID="e676de28adfe8b82f9f334920525fd99" STYLE="fork">
          <node TEXT="预期结果" ID="4e71d3c8c10296e773171cc51c2c8fd5" STYLE="fork">
            <node TEXT="成功拉取事件信息" ID="c11219401c520bae4ff712b55e49bafe" STYLE="fork"/>
            <node TEXT="展示 title / 类型 / slug / 分类" ID="aa742dd1413a9912516ea429702947de" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="输入不存在的 ID/Slug" ID="b158ee561ce48a8de13f782088b331b7" STYLE="fork">
        <node TEXT="预期结果" ID="7eb59aca2028d61c08eec956a84a8080" STYLE="fork">
          <node TEXT="搜索失败" ID="0b8dd3ab3f1ba26d830f86a25098e21f" STYLE="fork"/>
          <node TEXT="提示事件不存在/拉取失败" ID="c500285be694171541db220ce73f29a8" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="添加事件时必填项校验" ID="85bcd4e3a2b58684b61b41ec6f8718bf" STYLE="fork">
        <node TEXT="事件名称（英文）" ID="591d4bc62487643af2873f97dcfb8eb4" STYLE="fork"/>
        <node TEXT="市场名称（英文）" ID="75b51bae29a6810f57edd2f7c81b70b9" STYLE="fork"/>
        <node TEXT="事件分类" ID="f46836ab4435ac1df0940a3376b1e884" STYLE="fork"/>
        <node TEXT="三档费率" ID="8afc476801d70af772b4d7df997b6e2b" STYLE="fork"/>
        <node TEXT="状态" ID="99a71adacd4a4c750e1d0f651c5ce6f9" STYLE="fork"/>
        <node TEXT="交易开关" ID="bceb04c82cd8cf0edc2bbf1c938ae60c" STYLE="fork"/>
        <node TEXT="预期结果" ID="63e6f03c3de9c3582b6f6e85d6e40ee1" STYLE="fork">
          <node TEXT="缺失任意必填项保存失败" ID="6d444de738c584d4ae88b650eaaf0465" STYLE="fork"/>
          <node TEXT="提示“请填写必填项”" ID="e68b9ecdd0183ba7607f934017568f7e" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="自动带出 PM 英文名与多语言" ID="ba5df78ee6d52d658866822332b67186" STYLE="fork">
        <node TEXT="预期结果" ID="e31d61d1c72539bdd91fa9831823154f" STYLE="fork">
          <node TEXT="事件名称/市场名称自动填充 PM 返回值" ID="6ac5a3bc34079d1740ec520f5a3c5269" STYLE="fork"/>
          <node TEXT="可配置多语言" ID="6446d95d77e63ec45b34a956e89afc88" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="分类联动选择" ID="b1248f2e341f7d1d6ae20aea83c00a69" STYLE="fork">
        <node TEXT="选择一级分类，若存在二级/三级分类继续选择" ID="647ae512155a6fdc4aa9d4f040dde44c" STYLE="fork">
          <node TEXT="预期结果" ID="2124c17fa2fe6c63c7478c8da3b0a6c6" STYLE="fork">
            <node TEXT="仅在存在下级分类时展示下一级选择框" ID="1d3dd1013a9fc12429c7ebd34c9cc0e6" STYLE="fork"/>
            <node TEXT="各级分类必填" ID="1a5c15010be039d87576ee6991e4e0f3" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="保存成功后事件入库" ID="d6c95f3946c2e8986e1943bb095a20fe" STYLE="fork">
        <node TEXT="预期结果" ID="0f2f020d97e5ea23e9b730d1c1f162e7" STYLE="fork">
          <node TEXT="事件列表可见" ID="3aa2411e9d6942e44f280a7e3f225242" STYLE="fork"/>
          <node TEXT="事件信息与配置保存正确" ID="b2fcd3d426c6543ae11391d47c7fccdc" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="事件列表字段展示正确" ID="0a4db348ff43925c5354a236e18a5e56" STYLE="fork">
        <node TEXT="预期结果" ID="20086eb8cceb00ac98f357c51dda7a44" STYLE="fork">
          <node TEXT="事件ID" ID="767e0df0482ac928d82dae82c9a4da7d" STYLE="fork"/>
          <node TEXT="事件名称" ID="22de530ea7b0d3e3238e07beb74e00c3" STYLE="fork"/>
          <node TEXT="类型" ID="3d52bb1225573dc46744e929a0019f26" STYLE="fork"/>
          <node TEXT="一级/二级/三级分类" ID="467ea185bcc85c8a470629e6ca52f393" STYLE="fork"/>
          <node TEXT="上线时间" ID="571eca50156b5b8158bdbf463679e6d1" STYLE="fork"/>
          <node TEXT="结算时间" ID="89039712b3b189bed1b7271ef984e155" STYLE="fork"/>
          <node TEXT="买入/卖出/结算 rate" ID="a44719461e607a9276706daeeae11846" STYLE="fork"/>
          <node TEXT="对账最小份额阈值" ID="f66820c795488118bd175ae007cb6953" STYLE="fork"/>
          <node TEXT="状态" ID="2450d1867e07e703f0106edc7fd44d3d" STYLE="fork"/>
          <node TEXT="Polymarket 状态" ID="cdf3e0b5f26c10512dfe244918f5cac1" STYLE="fork"/>
          <node TEXT="交易开关" ID="94380ee68e22c8fd3dd983bb3e03428f" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按多级分类筛选" ID="470cf2e49b602f7e5cf02d15f7836e2c" STYLE="fork">
        <node TEXT="预期结果" ID="cc4fca42f0fb507839138e913debf7f8" STYLE="fork">
          <node TEXT="显示正确数据" ID="61183c1b0d400b555a96626c1d684609" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按上线状态筛选" ID="1d91608bff2a797eefe559a4b891a63a" STYLE="fork">
        <node TEXT="预期结果" ID="6f71c6c7b1865199cc724680b11f0039" STYLE="fork">
          <node TEXT="显示正确数据" ID="0691408605ac636198623600920c8586" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按名称检索" ID="f2e176ddd6e5930ffff1a2b58ae72b2c" STYLE="fork">
        <node TEXT="预期结果" ID="109cd80b6214d359f96af6158d36ee32" STYLE="fork">
          <node TEXT="显示正确数据" ID="c4963890aa382a9ec64c32314d11f3e9" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="下线事件" ID="111243605361a6cd3e06edb8c7fb67e1" STYLE="fork">
        <node TEXT="点击下线，二次确认" ID="8f789ceb3e4665117e24395c465335c4" STYLE="fork">
          <node TEXT="预期结果" ID="3ebfe9b8c2b54edfc944b65d68b789c4" STYLE="fork">
            <node TEXT="事件状态变为下线" ID="2d6cefbc82c9718514d8cf47b5b0b662" STYLE="fork"/>
            <node TEXT="前端不可见" ID="6b25a7d90d1b2b1c48bd3090ad969035" STYLE="fork"/>
            <node TEXT="不可交易" ID="b0e17b7fd5fa523ed41ebe773d7a5220" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="上线事件" ID="11cac2a89337691078c0520ba1e2a0d5" STYLE="fork">
        <node TEXT="预期结果" ID="d82eecdc3930b31a3fb0b50d361c32b3" STYLE="fork">
          <node TEXT="前端恢复展示" ID="e082cc911908dd89a634ecead0a213a9" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="关闭交易开关" ID="12d998ebeec2eb81305ee8207cef073b" STYLE="fork">
        <node TEXT="预期结果" ID="ded9cd2c50577cee429e5b079a46c7c3" STYLE="fork">
          <node TEXT="事件仍可见（若状态允许）" ID="a9dd427c8214b4553059b0d51cec6f6d" STYLE="fork"/>
          <node TEXT="前端不可买卖" ID="035a5a83c3a158cb5398e7d182ce4f7d" STYLE="fork"/>
          <node TEXT="后端下单时报 toast：“当前事件不可进行交易”" ID="572cfc883e513d1d810d940ded334dbe" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="上下线与交易开关独立性" ID="b6724aa5c56b45e2971ca64dfd92fb28" STYLE="fork">
        <node TEXT="上线 + 关闭交易，下线 + 开启交易" ID="45b9c1d40aff32ec4177dc3f1b490685" STYLE="fork">
          <node TEXT="预期结果" ID="5af042a0c3100952a13dfda22a920052" STYLE="fork">
            <node TEXT="逻辑互相独立，最终前端表现符合产品定义，上下线和交易开关,都基于事件在polymarket生效情况下,如果事件截止或者关闭,  平台这边也会下线,上线会拦截&amp;提示" ID="dcc286ad9940c6523d69bf6ad4465383" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="配置事件级买入/卖出/结算 rate 成功" ID="335f51b0026b8cede8dd104c07464e96" STYLE="fork">
        <node TEXT="预期结果" ID="f09cf6d408ed862e60b834d768aa43c0" STYLE="fork">
          <node TEXT="保存成功" ID="9b305a21f71f9bcda3dc2eaabdc2dca5" STYLE="fork"/>
          <node TEXT="覆盖全局默认费率" ID="584a0a8b7e594f2a9f1231edc99a0cea" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="修改事件 rate 后即时生效" ID="37e5e1a712eb81d7c7809de9f6d5cfb9" STYLE="fork">
        <node TEXT="修改某事件 rate，立刻在该事件下单" ID="46355112c4838c2a2d832095db75d455" STYLE="fork">
          <node TEXT="预期结果" ID="788722349f50425dc69b71f9c88cbe2f" STYLE="fork">
            <node TEXT="新订单按新费率计算" ID="3b7d539e5d391a625ec74d56ba641825" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="GAME 类型识别正确" ID="ed2f62775765ad9dcf92f11b700b4374" STYLE="fork">
        <node TEXT="准备体育比赛类 Event" ID="cd727891daa18927f8a3e76554d41899" STYLE="fork">
          <node TEXT="预期结果" ID="a0aa39b33b54c33b1d7e4f4768065953" STYLE="fork">
            <node TEXT="含 sportsMarketType/gameId/teamA/teamB 的事件识别为 GAME" ID="6d434315aa314da6b3f3ed04dfd386ac" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="EVENT 类型识别正确" ID="9bddf36742777b7697838aa7f35c1559" STYLE="fork">
        <node TEXT="准备普通事件类 Event" ID="dab9e8b45bdbe439f58409d6e06c8f36" STYLE="fork">
          <node TEXT="预期结果" ID="8d5a5c2a1752b7e8fa32f5a5a7ae23cd" STYLE="fork">
            <node TEXT="不含 sports 相关字段的识别为 EVENT" ID="91e83f906134167e25e1200596a2ac5f" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="tags 映射分类正确" ID="e935abeccc13d0aadc79f46a7edd2f95" STYLE="fork">
        <node TEXT="预期结果" ID="9a2f4332089eac87bc8bfcbdd242ec9f" STYLE="fork">
          <node TEXT="一级/二级/三级分类与 Polymarket tags 映射一致" ID="a83806ad121530a021812a1f028228d3" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="无映射 tag 归入“其他”" ID="8afd2f8fbaf9c81e2e70d2a71f9b5c22" STYLE="fork">
        <node TEXT="预期结果" ID="83496e91efb9f207b2248b3abf08cecf" STYLE="fork">
          <node TEXT="未配置映射时归类到“其他”" ID="ad703973a2ed8aabe3f657ef516c6768" STYLE="fork"/>
          <node TEXT="提示运营补映射（如有提示机制）" ID="ff2b9077179b6558db16c5e7befd7933" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="仅 enableOrderBook=true 的市场允许交易" ID="6bbb21dad0578ceb3438d41f7e2641b0" STYLE="fork"/>
      <node TEXT="审计日志记录" ID="02d248c2b4b6cb2517ceef8174dfeda2" STYLE="fork">
        <node TEXT="修改事件分类、费率、状态、交易开关" ID="221243496b1b172df27eb7ea6ce88fcc" STYLE="fork">
          <node TEXT="预期结果" ID="deb7102ba1b8c8dcedc8c2db1b78f9e1" STYLE="fork">
            <node TEXT="记录操作人、时间、变更前后值" ID="b898467b748cd04afadf4bd21443b37f" STYLE="fork"/>
          </node>
        </node>
      </node>
    </node>
    <node TEXT="订单管理" ID="da11cc9bfdb7ff88c456c23fdfbedab1" STYLE="bubble" POSITION="right">
      <node TEXT="订单列表展示正确" ID="75e3a7758391c83251949f287a2ee8bc" STYLE="fork">
        <node TEXT="预期结果" ID="465fc108858e5f5e2b98d328ed8dd78a" STYLE="fork">
          <node TEXT="字段完整展示" ID="11179fe1157f294acc581f146b79d445" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按类型筛选" ID="d151cd23887fbbf8b5be4ea756eab518" STYLE="fork">
        <node TEXT="预期结果" ID="4147fec31f56f9e8d26961a2448b8322" STYLE="fork">
          <node TEXT="字段完整展示" ID="8eb1949ee667928cb4990b8009fb17aa" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按状态筛选" ID="bc06ae46d2bb35c800f8e212f97f9517" STYLE="fork">
        <node TEXT="预期结果" ID="70b464ef1cf28fb7d34e040186b9f4bd" STYLE="fork">
          <node TEXT="字段完整展示" ID="0efc8e83000a40f1c56d56d1409e4536" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按 UID 检索" ID="8c8ac5a12c5e597cd5d634b92967e6ac" STYLE="fork">
        <node TEXT="预期结果" ID="db67e28b01ca254c798587f441054614" STYLE="fork">
          <node TEXT="字段完整展示" ID="247d056e79efccd50bed5a1289a324a2" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按订单ID检索" ID="601e91dfebbe7dac1f84ff7fbb63cded" STYLE="fork">
        <node TEXT="预期结果" ID="0765a2e855d2bb860b858a1896975e37" STYLE="fork">
          <node TEXT="字段完整展示" ID="7a11af473885042b5db3166de9e83d24" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按哈希检索" ID="01ea75a0122e0bd5566f8531f588f6c3" STYLE="fork">
        <node TEXT="预期结果" ID="48963f8bb048753465c25a9b6cf401dc" STYLE="fork">
          <node TEXT="字段完整展示" ID="2fc3fb6c8299b04883d3ab9f4487396f" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按创建时间区间筛选" ID="0007639d6810344e85b2d7c00632b0cb" STYLE="fork">
        <node TEXT="预期结果" ID="9b31534d00982c11ec73d6102a6add15" STYLE="fork">
          <node TEXT="字段完整展示" ID="3d9aece04364294cfb93331016e276a1" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按成交时间区间筛选" ID="5a98904095dd94a3f6c699d5a592f0c5" STYLE="fork">
        <node TEXT="预期结果" ID="55505cdbd6770c4ade68763811eab95c" STYLE="fork">
          <node TEXT="字段完整展示" ID="4261e1813bc1bead5fef3a62d7615300" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="买入订单金额展示正确" ID="99904fc0b5543844d430b8635562f1a0" STYLE="fork">
        <node TEXT="预期结果" ID="424fa89b65479d62fcda2c77c4129cc3" STYLE="fork">
          <node TEXT="金额显示用户下单金额" ID="e99ec7594b7a61a89a4a5e909079ce84" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="卖出/结算订单金额展示正确" ID="768ae9f552183fd0ce7069078e4d5d05" STYLE="fork">
        <node TEXT="预期结果" ID="13355e375563f452224aa106f1b2ff67" STYLE="fork">
          <node TEXT="金额显示返还金额" ID="b60c052e5d92c1c9d97865a9dbc77dde" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="平台收入字段正确" ID="94d50cb42d2faff1fa59631cde1efc99" STYLE="fork">
        <node TEXT="预期结果" ID="396548b03315b35dd5d7c61ef4c37111" STYLE="fork">
          <node TEXT="买入订单归集买入加价收入" ID="7f493e56f3fe3b6e2ef736e8ad4c31f8" STYLE="fork"/>
          <node TEXT="卖出订单归集卖出抽水收入" ID="4ce6095ba34a9af4d8665cb6e0592a87" STYLE="fork"/>
          <node TEXT="结算订单归集结算抽水收入" ID="04fb356d42bbf8bb22b5b8c96c6e5478" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="订单ID 与哈希一一对应" ID="cf179b256ac0bdeeb2e37f1a1a172fe9" STYLE="fork">
        <node TEXT="预期结果" ID="dada7c568ce608df2d5a842f3b3db4f6" STYLE="fork">
          <node TEXT="订单ID与哈希一一对应" ID="37f6aba8aaacc78eab13318d503dc97c" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="哈希跳转 Polygonscan" ID="1912e4d8234fbd7c1ed7a435c298c919" STYLE="fork">
        <node TEXT="预期结果" ID="0dc7287f80e2ac07b4790e4181009594" STYLE="fork">
          <node TEXT="正常跳转" ID="677a689814eeda82466e158a4ee3b66e" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="失败订单自动退回冻结资金" ID="68fad2ef91e952bea79e2b500c52a098" STYLE="fork">
        <node TEXT="构造失败买入/卖出" ID="089bde2248faede9ac6878db7b78856c" STYLE="fork">
          <node TEXT="预期结果" ID="b6bae280fe0acb1763343f90bb1905ee" STYLE="fork">
            <node TEXT="状态=失败" ID="7c9ab05c62c015f0679575f2d7780ea9" STYLE="fork"/>
            <node TEXT="冻结资金自动退回现货账户" ID="1f7166267fb89ce8210589963714b774" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="成功订单状态流转正确" ID="82d206fb9849326fe0278d215db33e8a" STYLE="fork">
        <node TEXT="预期结果" ID="2ba4bbfdcc9e774f108be70a6ca3e3f8" STYLE="fork">
          <node TEXT="成交中 → 成功" ID="4cba935bcc1c343745b867c2a65f3cdd" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="结算订单状态流转正确" ID="431a4304b05bf2b3d75ad62226e34b40" STYLE="fork">
        <node TEXT="预期结果" ID="2684cf5918f616cae8f5047afb836ece" STYLE="fork">
          <node TEXT="结算中 → 成功 / 失败" ID="98f2d25168a34b892d711609b3908c6c" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="导出 CSV" ID="c5ec86e7fe7fd89e937d51060304822e" STYLE="fork">
        <node TEXT="预期结果" ID="de4771cc52c16ab8aa0bfcef8d62c505" STYLE="fork">
          <node TEXT="导出数据与筛选结果一致/全部(是否限制条数)" ID="52ecc7aa363ae82c8dcf5aaa36eca02e" STYLE="fork"/>
        </node>
      </node>
    </node>
    <node TEXT="仓位管理" ID="dbcf7dde65ac71d19bda455d763c3946" STYLE="bubble" POSITION="right">
      <node TEXT="仓位列表展示正确" ID="c3426ca5abc60ecf7bd0cf1e171e3a71" STYLE="fork">
        <node TEXT="包含字段" ID="4b9495791a665b1e8dc06acfb8647724" STYLE="fork">
          <node TEXT="仓位ID" ID="5633e3fe278c353942f33c5243407dcd" STYLE="fork"/>
          <node TEXT="UID" ID="18643e4244348d0a1bff11b63358902f" STYLE="fork"/>
          <node TEXT="事件/方向" ID="861200bc7935bae0135a9745b8f935be" STYLE="fork"/>
          <node TEXT="保证金" ID="99de8bbcf17ea76aa2efdeb795937fa8" STYLE="fork"/>
          <node TEXT="份额" ID="ee74c474773ebe2f05bd813136d78cc2" STYLE="fork"/>
          <node TEXT="平台收入" ID="483551dbf0f566435fc04fc2af8640b7" STYLE="fork"/>
          <node TEXT="创建时间" ID="4776f3dc81d193d7f94c1511abe1939f" STYLE="fork"/>
          <node TEXT="最后更新时间" ID="fa7c9cf369e278dcf9e8441e2a4a867c" STYLE="fork"/>
          <node TEXT="状态" ID="e63947014373d7dbb0979c7870f6380e" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按状态筛选" ID="943af5dd27259bf63ce014d7191e608f" STYLE="fork">
        <node TEXT="状态" ID="16abf52db41ee1e52505847ffd605d9d" STYLE="fork">
          <node TEXT="持仓中 / 已平仓" ID="66ca8b6325f007fca6709ebfd6ee4f09" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按 UID / 仓位ID 检索" ID="5e1addf586cc8ae2123309436352deae" STYLE="fork">
        <node TEXT="状态" ID="a21deab387edea5aece8fefc23df5a63" STYLE="fork">
          <node TEXT="持仓中 / 已平仓" ID="cb8d48293520d858a99be4ecb64c7157" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="按创建时间 / 最后更新时间筛选" ID="d7b912595924a8e68865bf1a50c35086" STYLE="fork">
        <node TEXT="状态" ID="6ed6d99cf6d836016f83255c6b80a4a0" STYLE="fork">
          <node TEXT="持仓中 / 已平仓" ID="e80a6bd748519c804344739cd9ece1dc" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="导出 CSV" ID="9b1cca4c9daf3a99a5784609c511b66c" STYLE="fork">
        <node TEXT="预期结果" ID="d76685707c0edd72a031db14dc622230" STYLE="fork">
          <node TEXT="导出数据与筛选结果一致" ID="46f5ec022443a976aef69cfcf431dc1b" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="同市场同方向多次买入聚合为同一仓位" ID="6939fa3b0918bef323b1b4c4f38aee32" STYLE="fork">
        <node TEXT="用户对同一事件同一方向连续买入 2 次" ID="71ddde9f18697bf94f17de315d65af97" STYLE="fork">
          <node TEXT="预期结果" ID="5b3d58656faa65afb3ed0c7ab84e20ea" STYLE="fork">
            <node TEXT="仓位只有一条" ID="de8c3b0a98a55916200648e10547f5fe" STYLE="fork"/>
            <node TEXT="保证金累加" ID="1eb88e2aac71f5eea67d77f9c722974b" STYLE="fork"/>
            <node TEXT="份额累加" ID="f0e4cb08ce1c9c9a9969b6204a9e1c07" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="部分卖出后仓位更新正确" ID="d94bdfe9593dc3b565d1219f6fc451d2" STYLE="fork">
        <node TEXT="预期结果" ID="dc9c4d134cee2739192a2cf25563fd6b" STYLE="fork">
          <node TEXT="份额减少" ID="6e9fa6ec2517297ae3b63a73df81baf7" STYLE="fork"/>
          <node TEXT="状态仍为持仓中" ID="f790b48337b34f0e6b073363561bedd5" STYLE="fork"/>
          <node TEXT="平台收入更新" ID="f2b95ce29160e4ff443eb5819b885834" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="全部卖出平仓后状态变更" ID="34ed10933091226bc682fed3099f8b5d" STYLE="fork">
        <node TEXT="预期结果" ID="0bf4494ffd574d4c52a8415044e857fc" STYLE="fork">
          <node TEXT="状态变为已平仓" ID="acf96eb26fb807b39ea19131f3d8a3a8" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="到期结算后仓位状态变更" ID="7e9c944af4b6569fa4d33afbc17a5283" STYLE="fork">
        <node TEXT="预期结果" ID="b799bcc9c63d47161d9a1c211cbacb77" STYLE="fork">
          <node TEXT="状态变为已平仓" ID="822230f6a407f7635a270e568ef69e4a" STYLE="fork"/>
          <node TEXT="平台收入正确归集" ID="ea43bfc15dfbbc23de2eb7f33f2a64ff" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="最后更新时间取最近一笔成功订单结束时间" ID="a9417f3f76ecbc87e107aff216e798b6" STYLE="fork"/>
    </node>
    <node TEXT="手动平账" ID="5132492a58e97e51d485fd251437ccd0" STYLE="bubble" POSITION="right">
      <node TEXT="持仓差异列表展示正确" ID="28d78302821db0cbb04d7617a18288a3" STYLE="fork">
        <node TEXT="字段包含" ID="7601822a044920759b00e23fa5f1fbcb" STYLE="fork">
          <node TEXT="事件/方向" ID="17aa310feb64749f32920c44c0b44745" STYLE="fork"/>
          <node TEXT="交易所持仓" ID="61eab7397bc5eb9df8d9049da4740d95" STYLE="fork"/>
          <node TEXT="链上持仓" ID="5c290e0930f11a64411eac62be5a1023" STYLE="fork"/>
          <node TEXT="差值" ID="aa1e427cd5cf73c5a8e9d3a3c5d01eb2" STYLE="fork"/>
          <node TEXT="差异率" ID="7d5f7c9d5f6fc84f79183440195bc366" STYLE="fork"/>
          <node TEXT="建议动作" ID="314de454d3a5efa5bd4485628884f6ef" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="差值 &gt; 0 时建议链上买入" ID="908f78c72e147df2a7b9044c58341498" STYLE="fork">
        <node TEXT="预期结果" ID="dd3d6c778b1ebeb023f86bca34f0f56a" STYLE="fork">
          <node TEXT="建议动作 = 链上买入差值份额" ID="bce590a8f1b765217201fce824428632" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="差值 &lt; 0 时建议链上卖出" ID="b3e10810aa644c119009f9dc645937f8" STYLE="fork">
        <node TEXT="预期结果" ID="7a9ca8503b59107079ee8ce362fcffaf" STYLE="fork">
          <node TEXT="建议动作 = 链上买入差值份额" ID="18b31939ac346f012c59e9e6cf1b2c38" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="差异率计算正确" ID="116886475cd17754560b112295938e36" STYLE="fork">
        <node TEXT="预期结果" ID="56fdc7ab142fbbb78c6dd9e20d5b0e41" STYLE="fork">
          <node TEXT="差异率 = 差值 / 链上持仓（或按系统最终取绝对值定义）" ID="1e1d17fe21041ae346e7280516d04874" STYLE="fork"/>
          <node TEXT="百分比保留两位" ID="16264ceeb4ef0d7bd14230ca89efe165" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="差异超过阈值可发起平账" ID="c49f1d11e070b566aa00955284a91831" STYLE="fork">
        <node TEXT="点击“平账”" ID="6b11dcce685d139bef5bd47831058751" STYLE="fork">
          <node TEXT="预期结果" ID="d3c0ea878b0b4055a2105d905dccbbd9" STYLE="fork">
            <node TEXT="弹窗展示动作、挂单价格、FOK 方式" ID="f870c3f3ece3648d500915470f7b12f4" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="平账二次确认" ID="5432d51e1751c7edb0e055f885099519" STYLE="fork">
        <node TEXT="预期结果" ID="584ab6a47d6d858eb6cf36730ca55bd9" STYLE="fork">
          <node TEXT="弹窗文案“是否进行手动平账？”" ID="e011cadb6a1eb44f5577bbb214898d2d" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="交易所持仓 &gt; 链上持仓时执行链上买入" ID="31132df27d7ff500b9c33517b930a2a7" STYLE="fork">
        <node TEXT="预期结果" ID="15417d5f04a52720412ba71194577e3e" STYLE="fork">
          <node TEXT="买入份额 = 交易所 - 链上" ID="cd91b0774d9a183f226f2fc9c6f57425" STYLE="fork"/>
          <node TEXT="挂单价格取卖一价" ID="2b09afa8c1bbb4bb389d9c74e0c634e7" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="交易所持仓 &lt; 链上持仓时执行链上卖出" ID="6ac0267d58bdd41326c0e6e26401b3c7" STYLE="fork">
        <node TEXT="预期结果" ID="a44b6cf8a1764246658162d7de3b139e" STYLE="fork">
          <node TEXT="卖出份额 = |交易所 - 链上|" ID="06b4f5c908b15f69045116d8ec400983" STYLE="fork"/>
          <node TEXT="挂单价格取买一价" ID="92dcab4d0ced419a8d79417d76d3322d" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="低于最小差异阈值不执行平账" ID="a221cbc21907426c5454aa1f56c0cc23" STYLE="fork">
        <node TEXT="预期结果" ID="1aaa6e4aa799cc44bb5b1acfd62491de" STYLE="fork">
          <node TEXT="构造差额小于配置最小份额" ID="d18fa40d99b262591fab70ea29dfd970" STYLE="fork"/>
          <node TEXT="预期不展示平账操作按钮" ID="b5673a78b2767534222de0be54c265dc" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="平账成功后不产生用户订单" ID="62c7b1a425eddd42ba3ffb9627b279af" STYLE="fork">
        <node TEXT="预期结果" ID="6296a5c1ae64b4cd3de38a3993028227" STYLE="fork">
          <node TEXT="订单表无新增用户订单" ID="957dd87411876b6a9f34524f34dcfa72" STYLE="fork"/>
          <node TEXT="仅新增平账单记录" ID="f54c4d6c51b5b94399a854f293e90e2d" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="平账失败可重试" ID="972d1566a0942645cf18fb713c761c62" STYLE="fork">
        <node TEXT="预期结果" ID="95689f03d4835bc9fd7475f919dc710f" STYLE="fork">
          <node TEXT="FOK 未足额成交状态标记失败，支持重新发起平账" ID="acc3a859590c8765041ab4d16fdc5f8d" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="FOK 未成交" ID="f48e1a639c070323936f9fe37f2f8776" STYLE="fork">
        <node TEXT="预期结果" ID="2b571075e678d8c31e43f653b93f2d7c" STYLE="fork">
          <node TEXT="平账单状态=失败" ID="d0435f33e6b0f2ef67c3d09aaaa170aa" STYLE="fork"/>
          <node TEXT="可重新发起" ID="caec8c267fcf70c2f1805bba162eb394" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="平账记录留痕完整" ID="0439ad65a18ac89ff6ae432e29acd960" STYLE="fork">
        <node TEXT="预期结果" ID="1cf236382885bab34f3d4905885620c7" STYLE="fork">
          <node TEXT="记录平账单ID、事件/方向、动作、挂单价格、操作人、发起时间、完成时间、状态" ID="6fe01bdc7a43ab3daabbf96ab3c19bdf" STYLE="fork"/>
          <node TEXT="操作平账成功 / 失败" ID="85cf34c458e0b55345a1c9bb3b955386" STYLE="fork"/>
          <node TEXT="预期平账单 ID、操作人、价格、份额、时间、结果全部留存，支持导出" ID="462959653a50324376233ecb362f553e" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="平账记录导出" ID="d14d90e5dcb168a8b24dd833506efc66" STYLE="fork">
        <node TEXT="预期结果" ID="8fa8955cbc8dc5e8f63bc4b6ab2bf41b" STYLE="fork">
          <node TEXT="正常导出" ID="70bf822768edeaa93b5484a03e8d8cde" STYLE="fork"/>
        </node>
      </node>
    </node>
    <node TEXT="告警配置" ID="6498bad5c06bd00c4a5796a26c454955" STYLE="bubble" POSITION="right">
      <node TEXT="页面默认不可编辑" ID="72799ceaf4047d4c2e5f5ad0dbd37165" STYLE="fork">
        <node TEXT="预期结果" ID="211b63409f8a227d316c1e3b384e395e" STYLE="fork">
          <node TEXT="未点击修改前字段不可编辑" ID="0b924d19d49e6375611c9cd42678680a" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="点击修改后可编辑" ID="c728c2ddd6ea431aa440f1ba4d2e8339" STYLE="fork">
        <node TEXT="预期结果" ID="5f418f555b001098cdd7287986a550e6" STYLE="fork">
          <node TEXT="可进行输入/删除等修改操作" ID="8ee43df5595ffb663790cc1322c784e0" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="未填写参数保存失败，保存校验" ID="b5c9245f4940e36c6981565e75a3e4e5" STYLE="fork">
        <node TEXT="预期结果" ID="b3f5e53669baab5086b494e96dbcb1f0" STYLE="fork">
          <node TEXT="输入框变红" ID="193da656ab70e4ad199bbfa44dc63021" STYLE="fork"/>
          <node TEXT="提示“请输入参数后再保存”" ID="2b1cc342e76176640b901a1e026ed397" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="USDC 余额分级告警" ID="09066e136ce7f5ac8cbfe9a6b0c1864c" STYLE="fork">
        <node TEXT="预期结果" ID="a05c071486bbc6de03978a4ddc785075" STYLE="fork">
          <node TEXT="USDC &lt; 50,000 触发警告" ID="b7433b5c65fe393d4a60151b196e501c" STYLE="fork"/>
          <node TEXT="USDC &lt; 10,000 触发紧急告警" ID="96edf19398367a6f2e2bc7f49823058c" STYLE="fork"/>
          <node TEXT="操作修改紧急 / 警告余额阈值，钱包余额对应低于阈值" ID="8d738e11e85ca4b6948792c14e513342" STYLE="fork"/>
          <node TEXT="预期每分钟监控，分级推送 Lark 通知" ID="482153b7bb501c5a9ced516f6cfd6161" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="POL 代币余额告警" ID="6ddcaac6bbaa1e7e82e3360ca95fce57" STYLE="fork">
        <node TEXT="预期结果" ID="9a7cde36d766bd1f6586b76dd7c5d590" STYLE="fork">
          <node TEXT="POL &lt; 50 触发警告" ID="e5f6097b8a7f081f1b042e3b81bed30e" STYLE="fork"/>
          <node TEXT="POL &lt; 10 触发紧急告警" ID="dc4827a698a6bd800fea52ee829a3409" STYLE="fork"/>
          <node TEXT="配置 10（紧急）、50（警告），余额不足触发对应告警" ID="7f247b5166bce336150d0e23781d9b80" STYLE="fork"/>
          <node TEXT="钱包监控频率每分钟执行" ID="74be6f47f6b9d5e89c01e3e76b5e0f47" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="下单失败告警" ID="4c9a73892f22cbe4ad7945320034cf5f" STYLE="fork">
        <node TEXT="连续失败次数达到阈值触发告警" ID="90c24f84bb003bb5e0f63688494fd5df" STYLE="fork">
          <node TEXT="阈值=3，窗口=5分钟，构造 5 分钟内连续 3 次下单失败" ID="c10f01da3bf58e651ae8edb2785872c1" STYLE="fork">
            <node TEXT="预期结果" ID="4dd3a183c0eae5268d36ba94f7b18f74" STYLE="fork">
              <node TEXT="触发紧急告警" ID="d1cd711b1eddc244e82bc7368d4a31f7" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="开启“自动暂停事件交易”后生效" ID="c43dd8a5a0e6dfee1a7bc572f528a2a4" STYLE="fork"/>
        <node TEXT="解冻重试失败 3 次触发告警" ID="6fea62674968ed2b53ecc12801501be2" STYLE="fork">
          <node TEXT="预期结果" ID="43135cd2a1c12b5b5cb9a99b999e9f5e" STYLE="fork">
            <node TEXT="构造解冻连续重试 3 次失败" ID="9ee14d8fd4c5a15cc637dee2da2a3963" STYLE="fork"/>
            <node TEXT="预期推送人工处理 Lark 告警" ID="ce9516a54861601535f3a2a40e4a4c28" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="持仓差异告警" ID="70bd93953fe8676a38ee5067a70b3eb5" STYLE="fork">
        <node TEXT="差异率超过阈值触发告警" ID="793e048ba8ba899ba88c44d456836850" STYLE="fork"/>
        <node TEXT="差额小于最小对账差异时不告警" ID="727ab8a1bb129188adb759a3a567dbd1" STYLE="fork"/>
        <node TEXT="告警内容包含四要素" ID="09616e36116b6e88e49a89b1988c13b1" STYLE="fork">
          <node TEXT="包含事件名、交易所持仓、钱包持仓、差值" ID="56627b82eb238f4629807e0ab0bd4f98" STYLE="fork"/>
        </node>
        <node TEXT="告警动作配置为“仅 Lark 告警”" ID="c80194eec82c10d45a95c0db92bef905" STYLE="fork"/>
        <node TEXT="告警动作配置为“Lark + 标记待平账”" ID="0e447547f7285dcd20d9b35ef37f312f" STYLE="fork"/>
      </node>
      <node TEXT="通知渠道" ID="6ef2f23dbfad6536400073d60d6e45bc" STYLE="fork">
        <node TEXT="配置 Lark Webhook 成功" ID="85d67a75124b8d87727364586136ec03" STYLE="fork"/>
        <node TEXT="关闭 Lark 通知开关后不发送" ID="60fecb3fef58e51af86e86fec0cfc297" STYLE="fork"/>
        <node TEXT="紧急告警支持 @所有人" ID="4d31cfad40819a49072e11162b892237" STYLE="fork"/>
        <node TEXT="发送测试告警成功" ID="18d7debce6d60142d2a982e982deda69" STYLE="fork"/>
      </node>
    </node>
    <node TEXT="菜单权限" ID="9ff248dd5d4bdfed743d3948c2e6eec2" STYLE="bubble" POSITION="right">
      <node TEXT="admin权限" ID="2f9800077eec3e41397fe1bf1489c8e7" STYLE="fork">
        <node TEXT="超级管理员" ID="7c9df4309399a51f6aeb65418ea887df" STYLE="fork">
          <node TEXT="可操作所有菜单及按钮" ID="4006a037bff1eb2716d9ccdddc2c59ee" STYLE="fork"/>
        </node>
      </node>
      <node TEXT="运营权限" ID="2ee5ca4caded7062bd5a097ce167b6c2" STYLE="fork">
        <node TEXT="配置某个菜单" ID="b31e477ac3ada6429fad7b5130ee10b2" STYLE="fork">
          <node TEXT="登录后可操作该菜单中内容" ID="1f5a3cbd9d9198d7e0ea55abb6f5d811" STYLE="fork"/>
        </node>
        <node TEXT="该菜单中隐藏某个按钮权限" ID="df85b42bb84ccaa7a2e58e707fdb450d" STYLE="fork">
          <node TEXT="进入该菜单后不可操作按钮，操作弹出暂无权限的提示" ID="ea8792567d73e3ab1fbcfceacf88ea46" STYLE="fork"/>
          <node TEXT="进入该菜单后不可操作按钮 或隐藏该按钮 " ID="4e8d9d6ec17153dbd9e71af0992ce9eb" STYLE="fork"/>
        </node>
      </node>
    </node>
    <node TEXT="冒烟/showcase" ID="fe51e550a9e7d4ff1d823c54833f46f0" STYLE="bubble" POSITION="right">
      <node TEXT="事件管理" ID="0b0093d209c0e9417af031fa75bbad38" STYLE="fork">
        <node TEXT="新增事件成功" ID="92659eb70b56f55d95fcd994c09e4e5a" STYLE="fork">
          <node TEXT="1.进入【预测市场管理】-【事件管理】，2.点击“添加事件”，3.输入合法 Event ID 或 Slug 查询,4.配置事件名称、分类、三档 rate、状态、交易开关 点击保存" ID="f1cf8bcce7147d379678f07cde12574f" STYLE="fork">
            <node TEXT="预期结果" ID="6c7fe98f028f22463e3b449214cacded" STYLE="fork">
              <node TEXT="事件信息可正常拉取" ID="ebf4d36b758ac99e9f980b742620b991" STYLE="fork"/>
              <node TEXT="事件保存成功" ID="e4226bc7f2da04201636f61455d1aaab" STYLE="fork"/>
              <node TEXT="事件在列表中可见" ID="9360339b4bfb05e6c4aae0863c0027fb" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="新增事件必填项校验" ID="1b45e85e61752d0177bef4b7215ad283" STYLE="fork">
          <node TEXT="添加事件时不填写必填项（如事件名称/分类/rate/状态）点击保存" ID="a71fbf00b25e4f364ed3ea60bf6b2330" STYLE="fork">
            <node TEXT="预期结果" ID="6c54180d592b8b75a947c1986ded351d" STYLE="fork">
              <node TEXT="保存失败" ID="d0a9a9a509ce580b99ba7c080b44f494" STYLE="fork"/>
              <node TEXT="页面提示“请填写必填项”" ID="bb55c44bc5f2fc7123a3772d12f381be" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="关闭交易开关生效" ID="cbbd9858099478f533ae72b2d41f3555" STYLE="fork">
          <node TEXT="在事件列表中找到已上线事件，将交易开关设置为“关闭”，前端尝试对该事件下单" ID="bbd3be45531611a0df0bdd823103be31" STYLE="fork">
            <node TEXT="预期结果" ID="572cbb5091d427bba127b6476afa3346" STYLE="fork">
              <node TEXT="后台开关修改成功" ID="c5e5bd78632ebcabf92e46deea51b0c3" STYLE="fork"/>
              <node TEXT="前端不可买卖" ID="79da4a7d8742a25099ebb502522677cf" STYLE="fork"/>
              <node TEXT="下单时提示“当前事件不可进行交易”" ID="925a5410c4b4c809952488c7dbdd9022" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="事件下线生效" ID="c9cace5c6f6ccefc89ab86cd43f3028e" STYLE="fork">
          <node TEXT="在事件列表中将某事件下线，到前端查看该事件" ID="97b5cf8536199c6725d0919a4cd70c9a" STYLE="fork">
            <node TEXT="预期结果" ID="90da83cd61511d0b525c6e426d1e5f4a" STYLE="fork">
              <node TEXT="下线成功" ID="1c9da0d8898814094924ace3bda9385d" STYLE="fork"/>
              <node TEXT="前端事件不可见" ID="ab8c2ec4b4a93e417c20dec4629ee861" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="事件级 rate 配置生效" ID="3ec2a6e31ec81e7fbe1b9ef8ac63efd0" STYLE="fork">
          <node TEXT="修改某事件买入/卖出/结算 rate，针对该事件发起一笔记交易/结算" ID="6ce0b6e46e4648be5296d6d164b1e851" STYLE="fork">
            <node TEXT="预期结果" ID="40df5c817268f88f189c07aef5dcf5d3" STYLE="fork">
              <node TEXT="新费率保存成功" ID="b14b24d18873b66c459036d35ebcdf5a" STYLE="fork"/>
              <node TEXT="后续订单按事件级新费率计算" ID="429d273612ffc1c8a16a486a0793c579" STYLE="fork"/>
            </node>
          </node>
        </node>
      </node>
      <node TEXT="通用参数管理" ID="349914d185b6327c1469305838e6835a" STYLE="fork">
        <node TEXT="修改买入/卖出/结算 rate 成功" ID="4f440e902e792f4c9c6134542294432f" STYLE="fork">
          <node TEXT="进入通用参数页，修改买入 rate / 卖出 rate / 结算 rate，点击保存" ID="9d1d6aa7257c906b1e945d3268ff36e1" STYLE="fork">
            <node TEXT="预期结果" ID="de58f85c49359f2c948ae4bff84fbe4e" STYLE="fork">
              <node TEXT="保存成功" ID="39fd05c6b0e8dc6dfa7d24675b7c5376" STYLE="fork"/>
              <node TEXT="页面刷新后展示新值" ID="1bb03ea5a946ccb78f688f590600e8b6" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="rate 为空时保存失败" ID="0f91db0e7e12e16ca29d729ea90600d8" STYLE="fork">
          <node TEXT="清空某个 rate，点击保存" ID="822f225ab8511f344354d4ebc39d67dd" STYLE="fork">
            <node TEXT="预期结果" ID="00374e5db11ad89d41f1e4e6c5718906" STYLE="fork">
              <node TEXT="保存失败" ID="0584761106a1bdfa4a44c267fca99b1c" STYLE="fork"/>
              <node TEXT="提示“请填写参数”" ID="a76dea0225b8d4f4c390173086ebbd20" STYLE="fork"/>
            </node>
          </node>
        </node>
      </node>
      <node TEXT="每日收入统计" ID="e35ac17b698e97514179fbe6ad74aed9" STYLE="fork">
        <node TEXT="每日收入统计页正常展示" ID="5bf850c2de9270714d57c9f0df2da848" STYLE="fork">
          <node TEXT="进入【每日收入统计】页面" ID="d46b04bdee3e768fd7f6a8a10527b227" STYLE="fork">
            <node TEXT="预期结果" ID="05ca4dc4d3f6ff8c34d754623e7def5e" STYLE="fork">
              <node TEXT="页面正常打开" ID="3a86e97ed82e30037cbb5a87c4d1500d" STYLE="fork"/>
              <node TEXT="展示 KPI 卡、趋势图、明细表" ID="19d08daa3752808352d2133da12fa8e7" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="近7日数据查询成功" ID="54b2bceffb94cdd69f4910facf6b8cc7" STYLE="fork">
          <node TEXT="选择“近7日”" ID="cbba0e88e0ad0013308e64f92bd43139" STYLE="fork">
            <node TEXT="预期结果" ID="a08769aed5fd45708c45b707f78bb8b0" STYLE="fork">
              <node TEXT="页面数据刷新成功" ID="a6f75e22e65dd4a0b9f2e2cfe8de6ad6" STYLE="fork"/>
              <node TEXT="明细数据正常展示" ID="7744eedf8cb92d91926463fbf86b2511" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="自定义时间查询成功" ID="8d44e3c5ac550f9cc69f96da718099fc" STYLE="fork">
          <node TEXT="选择自定义时间区间" ID="3fc24416a14bd7b69c5199a7f6d5866c" STYLE="fork">
            <node TEXT="预期结果" ID="8f93bc5096b7c15df9cdde2b95fb694b" STYLE="fork">
              <node TEXT="数据按时间区间返回" ID="171c36b31a45204e1b40a963841d66b7" STYLE="fork"/>
              <node TEXT="汇总卡/趋势图/明细同步刷新" ID="331d182f6ffde6fe1b044c46549e3665" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="收入字段展示完整" ID="97e31d25cd0fc2a8f50c05528fd43b6c" STYLE="fork">
          <node TEXT="字段包含" ID="cdab53015bee2559bee7cfe8dae6e553" STYLE="fork">
            <node TEXT="买入加价收入" ID="ed758a31be7ba1f8e9f63b3132eadac7" STYLE="fork"/>
            <node TEXT="卖出抽水收入" ID="d668e3541cdddcbee3765fde3bffcfe6" STYLE="fork"/>
            <node TEXT="结算抽水收入" ID="78506193d0b3fcbe641df97eb3e1c026" STYLE="fork"/>
            <node TEXT="PM 手续费" ID="95fb41298f7536176f87c1019f685a03" STYLE="fork"/>
            <node TEXT="Gas" ID="43e473a5014d9f7526bad4e543293bf9" STYLE="fork"/>
            <node TEXT="毛利" ID="a3adb9499e1d971af8a46aac24fedb7b" STYLE="fork"/>
          </node>
        </node>
        <node TEXT="导出 CSV 成功" ID="418b747b701d936ce64632539cfadf0b" STYLE="fork">
          <node TEXT="在收入统计页点击导出" ID="e249a3b5b394d360d907f795b9b3d178" STYLE="fork">
            <node TEXT="预期结果" ID="40d75a811bf66f723d1b89439f5a1672" STYLE="fork">
              <node TEXT="成功导出 CSV" ID="d8387a171dd8d36518f3de1133b883cb" STYLE="fork"/>
              <node TEXT="导出字段与页面一致" ID="3434387ec2e33ac3962455f57c3fa358" STYLE="fork"/>
            </node>
          </node>
        </node>
      </node>
      <node TEXT="订单管理" ID="86e7692b1f05532f3c0ff4f435865707" STYLE="fork">
        <node TEXT="订单列表正常展示" ID="a0b3ef8c444e5d2c4364ae85b046141d" STYLE="fork">
          <node TEXT="进入订单管理页" ID="f7112c7079b28ea93681e2afb944eacf" STYLE="fork">
            <node TEXT="预期结果" ID="42130c0ca5cc56053e9c5375049490b9" STYLE="fork">
              <node TEXT="列表加载成功" ID="145f90ef6fd8d7cf9e8c34c6fe17ad16" STYLE="fork"/>
              <node TEXT="展示订单ID、哈希、UID、事件/方向、类型、金额、份额、平台收入、状态等字段" ID="49f7f9a160be88edfb4fb51d2095a513" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="按订单ID / UID 查询成功" ID="bbc6383f5ed342276ecb5da27f62adc6" STYLE="fork">
          <node TEXT="输入订单ID查询，输入UID查询" ID="70d4c7322ebd30d8a972fda6f417b58c" STYLE="fork">
            <node TEXT="预期结果" ID="fe239cbb2fc0ac3a1dd57c8aca65555a" STYLE="fork">
              <node TEXT="可准确检索对应订单" ID="14dc2969ef3b2ef61d7eaf2a37804873" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="买入/卖出/结算类型筛选成功" ID="92d8eedacef856ce7fd9ca5f27e35f71" STYLE="fork">
          <node TEXT="分别选择买入、卖出、结算筛选" ID="61c42105b855dcdeb0d55daf052f80b4" STYLE="fork">
            <node TEXT="预期结果" ID="795adff0fa19aa6a80f408644d38cd36" STYLE="fork">
              <node TEXT="列表仅展示对应类型订单" ID="2e384299d306dda4432c9041d5e93f6c" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="失败订单状态正确且资金退回" ID="c64f0773212fce01e0eb981032310ff9" STYLE="fork">
          <node TEXT="构造一笔失败订单，查看订单状态和用户资金" ID="d57f0b539a54707745341ed956903523" STYLE="fork">
            <node TEXT="预期结果" ID="2fb72942ac33b5c599053a3adb8fad06" STYLE="fork">
              <node TEXT="订单状态为失败" ID="ac597463eccf6014fcdd31fd290c3f63" STYLE="fork"/>
              <node TEXT="冻结资金退回现货账户" ID="283631ae946e0147c00bc5548ef978df" STYLE="fork"/>
            </node>
          </node>
        </node>
      </node>
      <node TEXT="仓位管理" ID="d2b643a5a3a257fd72349f4a620e9f8c" STYLE="fork">
        <node TEXT="仓位列表正常展示" ID="1981e779c5357eb0720357221c5ac045" STYLE="fork">
          <node TEXT="进入仓位管理" ID="c35d0ed5e2b6e363587c343b742f8e90" STYLE="fork">
            <node TEXT="预期结果" ID="4efd7b62f7b4b36e0ca2f37b136fd2cb" STYLE="fork">
              <node TEXT="页面可正常展示" ID="48c5655f2d296a6b1af2929787be2279" STYLE="fork"/>
              <node TEXT="列表包含仓位ID、UID、事件/方向、保证金、份额、平台收入、状态等字段" ID="d1955cede6acb19c6554407a36636df4" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="按 UID / 仓位ID 查询成功" ID="b8e5a33d281b35553d8470178a9b0419" STYLE="fork">
          <node TEXT="输入 UID / 仓位ID 查询" ID="ca850d971d5c6216b0858f196c452ab2" STYLE="fork">
            <node TEXT="预期结果" ID="c3c072070ad9051b4986714086165a56" STYLE="fork">
              <node TEXT="可查询到对应仓位" ID="7f7d6a106bd093a2332a174aba4267e3" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="同一事件同方向加仓后仓位正确聚合" ID="10d3a249e1666afd6d61d64925de0632" STYLE="fork">
          <node TEXT="用户对同一事件同一方向连续买入两次，查看仓位" ID="6846386d25bff855654f15e1b7e423a2" STYLE="fork">
            <node TEXT="预期结果" ID="eee94dd433a141a9d527eb38fa70b4cb" STYLE="fork">
              <node TEXT="仓位聚合为一条" ID="cf8e44cfa979ede2e9574de4248bccb4" STYLE="fork"/>
              <node TEXT="保证金、份额累加正确" ID="98077ff8dab4a2dd336323f993ff6439" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="卖出/结算后仓位状态更新正确" ID="5c2586a97c67a8a83551455c080bcb2d" STYLE="fork">
          <node TEXT="对已有仓位执行卖出或结算，查看仓位状态" ID="a15e63d095528512ef96775b8a756669" STYLE="fork">
            <node TEXT="预期结果" ID="08584f5f0e47556d8fd9a07061e853be" STYLE="fork">
              <node TEXT="部分卖出后仍为持仓中" ID="ea2f88ded9c2454ad2c0b292d3783cce" STYLE="fork"/>
              <node TEXT="全部卖出或结算后变为已平仓" ID="7db9dbb0be5ff2c5442ff6bdc13254f3" STYLE="fork"/>
            </node>
          </node>
        </node>
      </node>
      <node TEXT="手动平账" ID="b5ab7a732101e9f20a4ad805b0c23bfa" STYLE="fork">
        <node TEXT="持仓差异列表正常展示" ID="e16b3ebf9a4943d747c2c13f715807bd" STYLE="fork">
          <node TEXT="存在一笔持仓差异数据，进入手动平账页面" ID="a11f850951b9881b58bd5abf79b8db4f" STYLE="fork">
            <node TEXT="预期结果" ID="b4f3f5c675b60073d095ee7ceef1b338" STYLE="fork">
              <node TEXT="展示事件/方向、交易所持仓、链上持仓、差值、差异率、建议动作" ID="d1df051f32874bff2e8a63f588b42f91" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="发起手动平账成功" ID="da2656d1b6956dec2dffb8ac2f0e6e4d" STYLE="fork">
          <node TEXT="对一条差异记录点击“平账”，在确认弹窗点击确认" ID="5ea202530441276bd3e5ebc619777b40" STYLE="fork">
            <node TEXT="预期结果" ID="84ac788d228b50da8fa2471150a18958" STYLE="fork">
              <node TEXT="成功发起平账" ID="afe4dbdc48b1ae05475e6b10c75e482e" STYLE="fork"/>
              <node TEXT="生成平账记录" ID="b0dcd6b518cb0ab962020a1443b25292" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="平账后不产生用户订单" ID="385b532dc4729a8954599ae73b405533" STYLE="fork">
          <node TEXT="执行一笔手动平账，查看订单列表与平账记录" ID="90b886709e95ddff33f34e695e4e84da" STYLE="fork">
            <node TEXT="预期结果" ID="cbeccabd0867507e16b454e72c2160aa" STYLE="fork">
              <node TEXT="不新增用户订单" ID="108b4cc752ad1091e98f1232ab8330cc" STYLE="fork"/>
              <node TEXT="仅新增平账记录" ID="6e51f6859437dbf3864cddc0da641e39" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="平账记录留痕完整" ID="ea7d3f903121f462fda80d91e15a69e4" STYLE="fork">
          <node TEXT="平账字段" ID="e27cacd355c002e59c14cf56f9f05ad4" STYLE="fork">
            <node TEXT="平账单ID" ID="b0ca384e53f5480e84f1b885743809ee" STYLE="fork"/>
            <node TEXT="事件/方向" ID="7c4238a4e969a98d9dd4a958776f88f2" STYLE="fork"/>
            <node TEXT="动作" ID="373ab88cf7904b963bdeb78376e59bcb" STYLE="fork"/>
            <node TEXT="挂单价格" ID="f906a72552dd3c36bdd8fe5fa6fed6bb" STYLE="fork"/>
            <node TEXT="操作人" ID="6bf3b154a1a67f54f2c3752f841dfa16" STYLE="fork"/>
            <node TEXT="发起时间" ID="b9d0dfba8b7ee7738b39fa9bda4c467a" STYLE="fork"/>
            <node TEXT="完成时间" ID="840ea69a6e8059a6a5e95e63a307f90a" STYLE="fork"/>
            <node TEXT="状态" ID="6ca25c6bc77138e269b2ded92f857300" STYLE="fork"/>
          </node>
        </node>
      </node>
      <node TEXT="告警配置" ID="3d751099fcb96d6b96c674eb6d23a902" STYLE="fork">
        <node TEXT="告警配置页正常打开" ID="2a257727903356189e4126e6b06dd25b" STYLE="fork">
          <node TEXT="进入告警配置页" ID="ee60ecdc061c43c533e832781f939073" STYLE="fork">
            <node TEXT="预期结果" ID="2cdb1357b70ed25e10a874ae65fd78f5" STYLE="fork">
              <node TEXT="页面正常展示钱包告警、下单失败告警、持仓差异告警、Lark 配置项" ID="0f598c8bb0fd31cd8a9b904b3007333c" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="告警阈值修改保存成功" ID="58d51501e716508c768a9cef02dcc1fb" STYLE="fork">
          <node TEXT="点击修改，修改任一阈值（如连续失败次数、差异率阈值，点击保存" ID="33558367940254982890dfc52eb6c3f6" STYLE="fork">
            <node TEXT="预期结果" ID="e77523a5209257648e1d74111fe37e39" STYLE="fork">
              <node TEXT="保存成功" ID="58e94b079d32b5a7a56ba17795f1c39b" STYLE="fork"/>
              <node TEXT="新阈值生效" ID="73837853a3a07a645798875b9bf090f4" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="参数为空保存失败" ID="00f1b569fc2eb208dbb526c2b7bb6169" STYLE="fork">
          <node TEXT="清空某告警参数，点击保存" ID="863d74a313ff1c5fedc5f0396ea69795" STYLE="fork">
            <node TEXT="预期结果" ID="a00d139636994247f775488e37056665" STYLE="fork">
              <node TEXT="存失败" ID="c7fb40c93f614b5bc9285c3044e71e21" STYLE="fork"/>
              <node TEXT="提示“请输入参数后再保存”" ID="85b0e5486aff1ef72f1d1fef907387ec" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="告警发送成功" ID="4b704c5c1a0f9b0e3bb2e7bacc9805f7" STYLE="fork">
          <node TEXT="点击“发送测试告警”" ID="2220d93d0b9d87bac7c6f3cab5499f5f" STYLE="fork">
            <node TEXT="预期结果" ID="2b05fcd94782cae21b7f5c0e6d297663" STYLE="fork">
              <node TEXT="Lark 收到测试告警消息" ID="263553c64fba2f0ae6847e2bbb641931" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="下单连续失败触发告警" ID="646e677354678d7bfe15ebc6fa95bb81" STYLE="fork">
          <node TEXT="设置连续失败阈值=3，窗口=5分钟，构造 5 分钟内连续 3 次下单失败" ID="2f5e6071c127d6d6e6cbaa92463529b1" STYLE="fork">
            <node TEXT="预期结果" ID="1f6f17fd1be7867afc7154acac4144b8" STYLE="fork">
              <node TEXT="触发告警" ID="59cafcc137ad4dde9bc0bdbc2662f260" STYLE="fork"/>
              <node TEXT="Lark 收到通知" ID="bdce3689427189edb3a4549e6487c6ab" STYLE="fork"/>
            </node>
          </node>
        </node>
      </node>
      <node TEXT="埋点/核心链路" ID="1131cc700398a8aeeb2013ed6cb322f7" STYLE="fork">
        <node TEXT="买入埋点上报成功" ID="628937674f662c0cf5ccadfc83d2ac04" STYLE="fork">
          <node TEXT="用户发起一笔买入，抓取埋点" ID="7cedb660343efb7f0b12a38fd449d8ec" STYLE="fork">
            <node TEXT="预期结果" ID="574141e241c801e2c6dc2579edd62fab" STYLE="fork">
              <node TEXT="上报 polymarket_buy_submit" ID="c9ed67cfd6c446b16621377cda98a272" STYLE="fork"/>
              <node TEXT="买入成功后上报 polymarket_buy_result" ID="a88858a20e50d7249f1738764a302c22" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="卖出埋点上报成功" ID="347dc5e906b9325f20dfa0c8c90f4e87" STYLE="fork">
          <node TEXT="用户发起一笔卖出" ID="9b4778a1a2faa37e65a1390a9049b938" STYLE="fork">
            <node TEXT="预期结果" ID="d67f7096c6ab9c92879a6e1254e76efe" STYLE="fork">
              <node TEXT="上报 polymarket_sell_submit" ID="f7e48ab4f3b103726857a0be43ddcd31" STYLE="fork"/>
              <node TEXT="卖出成功后上报 polymarket_sell_result" ID="2960cd77e762eda1df404c8fb15eb306" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="结算埋点上报成功" ID="3fa5fa2a38fb9775f3537654fa8d6286" STYLE="fork">
          <node TEXT="触发一笔结算" ID="95f060036a219ac69fdfd1c0b14a4139" STYLE="fork">
            <node TEXT="预期结果" ID="ba43da9001c0fe04336ae5d68047599b" STYLE="fork">
              <node TEXT="上报 polymarket_settle" ID="fac4f8006e5ca7b4388a21e29f7e2ef5" STYLE="fork"/>
            </node>
          </node>
        </node>
      </node>
      <node TEXT="全链路端到端" ID="ec37403d4bf8d3fc387afbe7ad315331" STYLE="fork">
        <node TEXT="买入成功链路打通" ID="1fbe993ce1a968ce6a91654e36da214a" STYLE="fork">
          <node TEXT="新增并上线一个事件，用户前端买入一笔，后台查看订单、仓位、收入统计、埋点" ID="9145a242673e1c8f4b58f3bbf3695239" STYLE="fork">
            <node TEXT="预期结果" ID="612ab7351539a43ac423cc7ccc1fd04e" STYLE="fork">
              <node TEXT="下单成功" ID="7591db4ab6892efe666d9d25af73f3e8" STYLE="fork"/>
              <node TEXT="订单生成成功" ID="d12d1dbcea41b11dc2f7521a4c81cbf3" STYLE="fork"/>
              <node TEXT="仓位增加" ID="1bf7077d2e9784f98d4e671d250fdfab" STYLE="fork"/>
              <node TEXT="买入埋点上报成功" ID="87194a8d993fc81645477845447ff8c0" STYLE="fork"/>
              <node TEXT="收入统计中有对应买入加价收入" ID="a1ab7f6d9ed257545ff14afa18c66ba4" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="卖出成功链路打通" ID="3def71e93192b57b4340866a5cbf8a6a" STYLE="fork">
          <node TEXT="对已有仓位执行卖出" ID="1156ff654d6610bb489565fa2c448b7f" STYLE="fork">
            <node TEXT="预期结果" ID="46dd347448858c1e658efc55f5426af6" STYLE="fork">
              <node TEXT="卖出成功" ID="b844352db6636d2a0a003d60370e5b08" STYLE="fork"/>
              <node TEXT="订单成功" ID="bd8f9bcc0b473c45a955b2c1af62833f" STYLE="fork"/>
              <node TEXT="仓位减少/平仓" ID="989e776039e9dd0de1913f4e8ef745b2" STYLE="fork"/>
              <node TEXT="卖出抽水收入正确入账" ID="4847e47a0b8042fa930c26465585e94c" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="结算成功链路打通" ID="4995dad2f824100a6c8dfcbc02d94923" STYLE="fork">
          <node TEXT="构造事件到期结算" ID="d7d1e454f9a6c7cc9c60df39763e9494" STYLE="fork">
            <node TEXT="预期结果" ID="8aa180a4cd88623b4952fbe4027a7570" STYLE="fork">
              <node TEXT="结算成功" ID="0802b177b399a5881bb4b1bbbcda1eea" STYLE="fork"/>
              <node TEXT="仓位平仓" ID="0b02e0962ba37c0e7fc8e8d758a28d40" STYLE="fork"/>
              <node TEXT="结算收入正确" ID="b2cddb555acf3b70a86db578991c774d" STYLE="fork"/>
              <node TEXT="结算埋点上报成功" ID="afe582c2caad89b17a3fc58035478230" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="持仓差异告警→手动平账→差异回落" ID="6ceb16eac5996304be25793af0e39dc2" STYLE="fork">
          <node TEXT="1.构造持仓差异，2.触发告警，3.后台手动平，4.下一周期复核" ID="c3b989aa7eb706b0f8b1b8f0cccf83ab" STYLE="fork">
            <node TEXT="预期结果" ID="5b0c6cc71f11e1faef451d5a550b6387" STYLE="fork">
              <node TEXT="告警成功发送" ID="fdf71c107ecfe8ef604021dea5729609" STYLE="fork"/>
              <node TEXT="平账成功" ID="73da75c6193cb0d72c34ada6711faa6d" STYLE="fork"/>
              <node TEXT="差异率回落至阈值内" ID="2d8e66ef22cdf3f5b3bb3ea56bab4a76" STYLE="fork"/>
            </node>
          </node>
        </node>
        <node TEXT="完成流程" ID="54f3dde9aa6606b16ae68bdbc9803eb1" STYLE="fork">
          <node TEXT="后台添加体育事件→Web/App 买入→中途卖出→事件到期结算" ID="1a5a9a2c8ceb4ec8516928173a973117" STYLE="fork"/>
        </node>
      </node>
    </node>
  </node>
</map>