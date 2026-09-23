# PR-02419 实现笔记

## 代码调研结果

### 1. 用户类型字段
- **字段名**：`detail.type`（前端）/ `user_type`（API）
- **类型**：`number`
- **获取方式**：用户详情接口返回
- **类型定义**：`apps/admin/src/types/user.ts`

### 2. 用户类型列表
- **API**：`GET /v1/user_type`
- **返回格式**：`[{"id": 1, "name": "普通"}, {"id": 2, "name": "法幣商"}, ...]`
- **已知类型**：
  - 1: 普通用户
  - 2: 法币商
  - ?: 公司做市用户（待确认具体 ID）

### 3. 现有功能点
- ✅ 用户详情页：`apps/admin/src/apps/UserDetails/components/UserSecurityInfo.tsx`
  - 第 134-140 行有注释掉的"修改用户类型"按钮
  - 使用 `ModalType.modifyUserType`（已定义但未实现）
  
- ❌ 用户列表页：`apps/admin/src/apps/Users/`
  - 未找到"批量设置类型"功能
  
- ⚠️ 用户批量管理：`apps/admin/src/apps/UsersMassManage/`
  - 有操作日志中的"设置用户类型"记录
  - 但批量操作弹窗中未看到此功能

### 4. 待确认问题
1. **公司做市用户的 ID**：需要查看线上环境或询问后端
2. **批量设置类型功能**：是否已实现？在哪个页面？
3. **修改用户类型 API**：接口路径、请求参数格式

## 实现计划

### Phase 1: 确认缺失信息（阻塞）
- [ ] 确认"公司做市用户"的 type ID
- [ ] 确认修改用户类型的 API 接口
- [ ] 确认批量设置类型功能的现状

### Phase 2: 实现单个修改拦截（R-001）
**位置**：`apps/admin/src/apps/UserDetails/components/UserSecurityInfo.tsx`

1. 启用注释掉的"修改用户类型"按钮
2. 实现 `ModalType.modifyUserType` 的 Modal 组件
3. Modal 中显示用户类型下拉选择
4. 点击确认时，校验 `detail.type`：
   ```ts
   const COMPANY_MARKET_MAKER_TYPE = ?; // 待确认
   
   if (detail.type === COMPANY_MARKET_MAKER_TYPE) {
     Toast.error('该用户为公司做市用户，禁止修改用户类型');
     return; // 不发请求
   }
   ```

### Phase 3: 实现批量修改拦截（R-002, R-003）
**待确认**：批量设置类型功能的具体位置

方案 A：功能未实现，需要新增
方案 B：功能已存在，需要找到并添加拦截逻辑

### Phase 4: 后端错误处理（R-004）
在修改用户类型 API 的错误处理中，统一使用 `response.msg` 显示 Toast

## 技术细节

### Toast 文案（硬编码，不做 i18n）
- 单个修改拦截：`"该用户为公司做市用户，禁止修改用户类型"`
- 批量修改失败：`"${failedUids.join(', ')} 修改失败"`

### 文件清单（预计修改）
1. `apps/admin/src/apps/UserDetails/components/UserSecurityInfo.tsx` - 启用修改按钮
2. `apps/admin/src/apps/UserDetails/utils/useModal.tsx` - 实现修改类型 Modal
3. `apps/admin/src/constants/user.ts`（可能需要新增）- 定义用户类型常量
4. 待确认：批量设置类型相关文件

## 下一步
❗ **阻塞**：需要确认以下信息才能继续实现
1. 公司做市用户的 type ID
2. 修改用户类型的 API 接口定义
3. 批量设置类型功能的现状
