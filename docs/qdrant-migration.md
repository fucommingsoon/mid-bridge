# Qdrant 向量库数据迁移指南

## 📊 当前状态

**Volume 路径：** `/var/lib/docker/volumes/mid-bridge_qdrant_data/_data`
**当前大小：** 20K（尚未导入数据）

---

## 🚀 迁移方案

### 方案 1：直接复制 Docker Volume（推荐，同服务器）

**适用场景：**
- 测试库和正式库在同一台服务器
- 最快速、最简单的方法

**步骤：**

1. **停止测试库容器**
```bash
docker compose stop qdrant
```

2. **复制 Volume 数据**
```bash
# 创建备份目录
mkdir -p /root/backup/qdrant

# 复制数据
cp -r /var/lib/docker/volumes/mid-bridge_qdrant_data/_data/* /root/backup/qdrant/

# 打包压缩（可选）
tar -czf /root/backup/qdrant-data-$(date +%Y%m%d).tar.gz -C /var/lib/docker/volumes/mid-bridge_qdrant_data/_data .
```

3. **恢复到正式库**
```bash
# 停止正式库容器
docker compose stop qdrant

# 删除现有数据（如果需要）
rm -rf /var/lib/docker/volumes/mid-bridge_qdrant_data/_data/*

# 恢复数据
cp -r /root/backup/qdrant/* /var/lib/docker/volumes/mid-bridge_qdrant_data/_data/

# 或者从压缩包恢复
tar -xzf /root/backup/qdrant-data-20260311.tar.gz -C /var/lib/docker/volumes/mid-bridge_qdrant_data/_data

# 启动容器
docker compose start qdrant
```

---

### 方案 2：Qdrant 快照（跨服务器/备份）

**适用场景：**
- 跨服务器迁移
- 需要保留多个备份点

**步骤：**

1. **创建快照**
```bash
# 创建快照
curl -X PUT "http://localhost:6333/collections/medical_knowledge/snapshots" \
  -H "Content-Type: application/json" \
  -d '{}'

# 查看快照列表
curl -X GET "http://localhost:6333/collections/medical_knowledge/snapshots"
```

2. **下载快照**
```bash
# 快照保存在 /qdrant/storage/snapshots/
docker exec mid-bridge-qdrant-1 ls -lh /qdrant/storage/snapshots/

# 复制到宿主机
docker cp mid-bridge-qdrant-1:/qdrant/storage/snapshots/medical_knowledge-*.snapshot /root/backup/
```

3. **恢复快照**
```bash
# 上传快照到目标服务器
docker cp /root/backup/medical_knowledge-*.snapshot mid-bridge-qdrant-1:/qdrant/storage/snapshots/

# 恢复
curl -X PUT "http://localhost:6333/collections/medical_knowledge/snapshots/recover" \
  -H "Content-Type: application/json" \
  -d '{"location": "medical_knowledge-YYYY-MM-DD-HH-MM-SS.snapshot"}'
```

---

### 方案 3：导出向量数据（跨云服务商）

**适用场景：**
- 不同云服务商之间迁移
- 需要检查/修改数据

**创建导出脚本 `scripts/export-qdrant-vectors.ts`：**

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';

const client = new QdrantClient({ url: 'http://localhost:6333' });
const COLLECTION_NAME = 'medical_knowledge';
const BATCH_SIZE = 100;
const OUTPUT_FILE = './data/qdrant-vectors.json';

async function exportVectors() {
  const allPoints = [];
  let offset: string | null = null;

  while (true) {
    const result = await client.scroll(COLLECTION_NAME, {
      limit: BATCH_SIZE,
      offset: offset,
      with_payload: true,
      with_vector: true,
    });

    if (result.points.length === 0) break;

    allPoints.push(...result.points);
    console.log(`Exported ${allPoints.length} points...`);

    if (!result.next_page_offset) break;
    offset = result.next_page_offset;
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allPoints, null, 2));
  console.log(`✓ Exported ${allPoints.length} points to ${OUTPUT_FILE}`);
}

exportVectors().catch(console.error);
```

**导入脚本 `scripts/import-qdrant-vectors.ts`：**

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';

const client = new QdrantClient({ url: 'http://localhost:6333' });
const COLLECTION_NAME = 'medical_knowledge';
const BATCH_SIZE = 100;

async function importVectors() {
  const data = JSON.parse(fs.readFileSync('./data/qdrant-vectors.json', 'utf-8'));
  const points = data as Array<{ id: string; vector: number[]; payload: any }>;

  console.log(`Importing ${points.length} points...`);

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await client.upsert(COLLECTION_NAME, {
      points: batch,
    });

    console.log(`Progress: ${i + batch.length}/${points.length} points`);
  }

  console.log('✓ Import complete!');
}

importVectors().catch(console.error);
```

---

### 方案 4：定期自动备份

**创建备份脚本 `scripts/backup-qdrant.sh`：**

```bash
#!/bin/bash

BACKUP_DIR="/root/backup/qdrant"
DATE=$(date +%Y%m%d_%H%M%S)
VOLUME_PATH="/var/lib/docker/volumes/mid-bridge_qdrant_data/_data"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 停止容器
docker compose -f /root/.openclaw/workspace/mid-bridge/docker-compose.yml stop qdrant

# 创建备份
tar -czf "$BACKUP_DIR/qdrant-backup-$DATE.tar.gz" -C "$VOLUME_PATH" .

# 启动容器
docker compose -f /root/.openclaw/workspace/mid-bridge/docker-compose.yml start qdrant

# 清理 7 天前的备份
find "$BACKUP_DIR" -name "qdrant-backup-*.tar.gz" -mtime +7 -delete

echo "✓ Backup complete: $BACKUP_DIR/qdrant-backup-$DATE.tar.gz"
```

**添加到 crontab（每天凌晨 2 点备份）：**
```bash
crontab -e

# 添加以下行：
0 2 * * * /root/.openclaw/workspace/mid-bridge/scripts/backup-qdrant.sh >> /var/log/qdrant-backup.log 2>&1
```

---

## 📋 推荐方案

**同服务器：** 方案 1（直接复制 Volume）
**跨服务器：** 方案 2（Qdrant 快照）
**跨云/需要修改数据：** 方案 3（导出/导入 JSON）
**生产环境：** 方案 1 + 方案 4（备份策略）

---

## ⚠️ 注意事项

1. **备份前停止容器** - 避免数据不一致
2. **检查磁盘空间** - 100 万条向量可能占用数十 GB
3. **测试恢复** - 迁移前先在测试环境验证
4. **监控迁移进度** - 100 万条数据可能需要数小时

---

## 🔧 快速命令参考

```bash
# 查看当前数据大小
du -sh /var/lib/docker/volumes/mid-bridge_qdrant_data/_data

# 查看集合信息
curl -X GET "http://localhost:6333/collections/medical_knowledge"

# 查看点数
curl -X GET "http://localhost:6333/collections/medical_knowledge?with_payload=false&with_vectors=false"

# 创建快照
curl -X PUT "http://localhost:6333/collections/medical_knowledge/snapshots"

# 列出快照
curl -X GET "http://localhost:6333/collections/medical_knowledge/snapshots"
```
