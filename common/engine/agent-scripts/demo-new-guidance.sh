#!/bin/bash
# Phase 1 新指南效果演示脚本
# 用途：展示新的 extractionGuidance 包含的内容和领域检查清单

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 1 新抽取指南效果演示"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PROJECT_ID="${1:-PR-02233}"
OUTPUT_FILE="/tmp/extraction-demo-${PROJECT_ID}.json"

echo "📋 项目：${PROJECT_ID}"
echo "📄 输出：${OUTPUT_FILE}"
echo ""

# 生成抽取脚手架
echo "🔧 生成抽取脚手架..."
node common/engine/agent-scripts/vnext-extract.mjs \
  --project "prds/${PROJECT_ID}" \
  --out "${OUTPUT_FILE}"

echo "✅ 脚手架生成完成"
echo ""

# 显示 extractionGuidance 统计
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 extractionGuidance 统计"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

GUIDANCE=$(cat "${OUTPUT_FILE}" | jq -r '.extractionGuidance')
CHAR_COUNT=$(echo "$GUIDANCE" | wc -c | tr -d ' ')
LINE_COUNT=$(echo "$GUIDANCE" | wc -l | tr -d ' ')

echo "字符数：${CHAR_COUNT}"
echo "行数：${LINE_COUNT}"
echo ""

# 检查是否包含关键内容
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 关键内容检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_content() {
  local keyword="$1"
  local description="$2"
  if echo "$GUIDANCE" | grep -q "$keyword"; then
    echo "✅ $description"
  else
    echo "❌ $description（未找到）"
  fi
}

check_content "四遍精读法" "四遍精读法"
check_content "第 1 遍：全局扫描" "第 1 遍：全局扫描"
check_content "第 2 遍：分主题深入" "第 2 遍：分主题深入"
check_content "第 3 遍：富媒体深度解读" "第 3 遍：富媒体深度解读"
check_content "第 4 遍：自我完整性检查" "第 4 遍：自我完整性检查"
check_content "强制枚举协议" "强制枚举协议"
check_content "图片深度解读" "图片深度解读"
check_content "PR-02306" "历史案例 1：PR-02306"
check_content "PR-01930" "历史案例 2：PR-01930"
check_content "PR-02265" "历史案例 3：PR-02265"
echo ""

# 检测到的领域信号
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 检测到的领域信号"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if echo "$GUIDANCE" | grep -q "检测到的领域信号"; then
  echo "$GUIDANCE" | sed -n '/检测到的领域信号/,/请在抽取过程中逐项确认/p' | head -50
else
  echo "未检测到领域信号（PRD 可能不包含资金/权限/集合等关键词）"
fi
echo ""

# 显示 instructions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Instructions（简化指向详细 guidance）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat "${OUTPUT_FILE}" | jq -r '.instructions[]' | head -7
echo ""

# Source units 统计
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Source Units 统计"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_UNITS=$(cat "${OUTPUT_FILE}" | jq '.sourceUnits | length')
SEMANTIC_UNITS=$(cat "${OUTPUT_FILE}" | jq '[.sourceUnits[] | select(.kind == "semantic")] | length')
IMAGE_UNITS=$(cat "${OUTPUT_FILE}" | jq '[.sourceUnits[] | select(.kind == "image")] | length')
TABLE_UNITS=$(cat "${OUTPUT_FILE}" | jq '[.sourceUnits[] | select(.tableRole == "row")] | length')

echo "总数：${TOTAL_UNITS}"
echo "语义单元：${SEMANTIC_UNITS}"
echo "图片：${IMAGE_UNITS}"
echo "表格行：${TABLE_UNITS}"
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 对比总结"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "旧版（v3.4）："
echo "  - instructions: 9 条简短指令"
echo "  - 总长度：~500 字符"
echo "  - 无历史案例警示"
echo "  - 无领域检查清单"
echo ""
echo "新版（v3.5 Phase 1）："
echo "  - extractionGuidance: ${CHAR_COUNT} 字符，${LINE_COUNT} 行"
echo "  - 四遍精读法详细指南"
echo "  - 3 个历史遗漏案例"
echo "  - 领域检查清单自动激活"
echo "  - 理解摘要自动生成"
echo ""
echo "预期改进："
echo "  - 第一次准确率：60-70% → 90-95% (+30%)"
echo "  - 遗漏率：5-10% → 1-2% (-80%)"
echo "  - 审查返工：2-3 次 → 0-1 次 (-70%)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 演示完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 下一步："
echo "   1. 用真实 AI 按新指南抽取需求"
echo "   2. 观察第一次准确率是否提升"
echo "   3. 查看理解摘要是否帮助用户快速确认"
echo ""
echo "📄 完整输出已保存到：${OUTPUT_FILE}"
