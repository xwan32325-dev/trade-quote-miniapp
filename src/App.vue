<script>
// 应用根组件：仅保留生命周期日志，公共样式在下方
export default {
  onLaunch: function () {
    console.log('App Launch')
  },
  onShow: function () {
    console.log('App Show')
  },
  onHide: function () {
    console.log('App Hide')
  },
}
</script>

<style>
/* 全局基础样式与通用卡片 / 表单风格 */
page {
  background: #f5f6f8;
  color: #1f2937;
  font-size: 28rpx;
}
.page {
  padding: 24rpx;
  box-sizing: border-box;
}
.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 20rpx;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f1f3;
}
.field:last-child {
  border-bottom: none;
}
.field-label {
  flex: 1;
  color: #4b5563;
  padding-right: 16rpx;
}
.field-input {
  width: 280rpx;
  text-align: right;
  font-size: 28rpx;
  color: #111827;
}
.field-unit {
  color: #9ca3af;
  margin-left: 8rpx;
  font-size: 26rpx;
}
.btn {
  background: #2563eb;
  color: #ffffff;
  border-radius: 12rpx;
  padding: 22rpx 0;
  text-align: center;
  font-size: 30rpx;
}
.btn-ghost {
  background: #eef2ff;
  color: #2563eb;
}
.btn-danger {
  background: #fef2f2;
  color: #dc2626;
}
.row {
  display: flex;
  gap: 20rpx;
}
.row .btn {
  flex: 1;
}
.muted {
  color: #9ca3af;
  font-size: 24rpx;
}
.profit {
  color: #16a34a;
}
.loss {
  color: #dc2626;
}
.result-line {
  display: flex;
  justify-content: space-between;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f0f1f3;
}
.result-line:last-child {
  border-bottom: none;
}
.result-value {
  font-weight: 600;
}
</style>
