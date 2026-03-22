// ============================================================================
// Complete BPMN 2.0 XML Demo — 订单处理流程 (Order Processing Workflow)
//
// 参考 github.com/Heaven-bo/bpmn-export 示例项目风格:
// · 使用标准 bpmn: 命名空间前缀（bpmn-moddle 默认输出格式）
// · 包含条件表达式、默认流、排他/并行网关、消息事件等完整连线示例
// · 包含 DataObject / DataStore / TextAnnotation / Association 等辅助元素
// · DI 层 waypoint 采用边界交点坐标（与本插件 exporter 一致）
// ============================================================================

export const SAMPLE_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">

  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Pool_OrderProcess" name="订单处理流程" processRef="Process_Order" />
  </bpmn:collaboration>

  <bpmn:process id="Process_Order" name="订单处理流程" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_Sales" name="销售部">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>UserTask_ReceiveOrder</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>UserTask_ConfirmOrder</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_OrderCheck</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>SendTask_Notify</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Warehouse" name="仓储部">
        <bpmn:flowNodeRef>ServiceTask_CheckInventory</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Stock</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>UserTask_PrepareGoods</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>ServiceTask_Restock</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Merge</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Logistics" name="物流部">
        <bpmn:flowNodeRef>ParallelGw_Split</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>ServiceTask_GenLabel</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>ManualTask_Package</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>ParallelGw_Join</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>ServiceTask_Ship</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>IntermediateThrowEvent_Shipped</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_Done</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>

    <!-- ===== 开始事件 ===== -->
    <bpmn:startEvent id="StartEvent_1" name="收到订单">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
      <bpmn:messageEventDefinition id="StartEvent_1_ed" />
    </bpmn:startEvent>

    <!-- ===== 销售部 ===== -->
    <bpmn:userTask id="UserTask_ReceiveOrder" name="录入订单">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:exclusiveGateway id="Gateway_OrderCheck" name="订单有效?" default="Flow_Reject">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:outgoing>Flow_Reject</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <bpmn:userTask id="UserTask_ConfirmOrder" name="确认订单">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:sendTask id="SendTask_Notify" name="通知客户">
      <bpmn:incoming>Flow_Reject</bpmn:incoming>
      <bpmn:outgoing>Flow_ToEnd2</bpmn:outgoing>
    </bpmn:sendTask>

    <!-- ===== 仓储部 ===== -->
    <bpmn:serviceTask id="ServiceTask_CheckInventory" name="检查库存">
      <bpmn:incoming>Flow_4</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:exclusiveGateway id="Gateway_Stock" name="有库存?">
      <bpmn:incoming>Flow_5</bpmn:incoming>
      <bpmn:outgoing>Flow_6</bpmn:outgoing>
      <bpmn:outgoing>Flow_7</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <bpmn:userTask id="UserTask_PrepareGoods" name="备货">
      <bpmn:incoming>Flow_6</bpmn:incoming>
      <bpmn:outgoing>Flow_8</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:serviceTask id="ServiceTask_Restock" name="补货采购">
      <bpmn:incoming>Flow_7</bpmn:incoming>
      <bpmn:outgoing>Flow_9</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:exclusiveGateway id="Gateway_Merge">
      <bpmn:incoming>Flow_8</bpmn:incoming>
      <bpmn:incoming>Flow_9</bpmn:incoming>
      <bpmn:outgoing>Flow_10</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <!-- ===== 物流部 ===== -->
    <bpmn:parallelGateway id="ParallelGw_Split">
      <bpmn:incoming>Flow_10</bpmn:incoming>
      <bpmn:outgoing>Flow_11</bpmn:outgoing>
      <bpmn:outgoing>Flow_12</bpmn:outgoing>
    </bpmn:parallelGateway>

    <bpmn:serviceTask id="ServiceTask_GenLabel" name="生成快递单">
      <bpmn:incoming>Flow_11</bpmn:incoming>
      <bpmn:outgoing>Flow_13</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:manualTask id="ManualTask_Package" name="打包商品">
      <bpmn:incoming>Flow_12</bpmn:incoming>
      <bpmn:outgoing>Flow_14</bpmn:outgoing>
    </bpmn:manualTask>

    <bpmn:parallelGateway id="ParallelGw_Join">
      <bpmn:incoming>Flow_13</bpmn:incoming>
      <bpmn:incoming>Flow_14</bpmn:incoming>
      <bpmn:outgoing>Flow_15</bpmn:outgoing>
    </bpmn:parallelGateway>

    <bpmn:serviceTask id="ServiceTask_Ship" name="发货">
      <bpmn:incoming>Flow_15</bpmn:incoming>
      <bpmn:outgoing>Flow_16</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:intermediateThrowEvent id="IntermediateThrowEvent_Shipped" name="已发货">
      <bpmn:incoming>Flow_16</bpmn:incoming>
      <bpmn:outgoing>Flow_17</bpmn:outgoing>
      <bpmn:messageEventDefinition id="IntermediateThrowEvent_Shipped_ed" />
    </bpmn:intermediateThrowEvent>

    <bpmn:endEvent id="EndEvent_Done" name="订单完成">
      <bpmn:incoming>Flow_17</bpmn:incoming>
      <bpmn:incoming>Flow_ToEnd2</bpmn:incoming>
    </bpmn:endEvent>

    <!-- ===== 数据元素 ===== -->
    <bpmn:dataObjectReference id="DataObject_Order" name="订单数据" />
    <bpmn:dataStoreReference id="DataStore_Inventory" name="库存数据库" />

    <!-- ===== 注释 ===== -->
    <bpmn:textAnnotation id="Annotation_1">
      <bpmn:text>通过电商平台接收订单</bpmn:text>
    </bpmn:textAnnotation>

    <bpmn:textAnnotation id="Annotation_2">
      <bpmn:text>需当日发货</bpmn:text>
    </bpmn:textAnnotation>

    <!-- ===== 顺序流（Sequence Flows） ===== -->
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="UserTask_ReceiveOrder" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="UserTask_ReceiveOrder" targetRef="Gateway_OrderCheck" />
    <bpmn:sequenceFlow id="Flow_3" name="有效" sourceRef="Gateway_OrderCheck" targetRef="UserTask_ConfirmOrder">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${"${orderValid == true}"}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Reject" name="无效（默认）" sourceRef="Gateway_OrderCheck" targetRef="SendTask_Notify" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="UserTask_ConfirmOrder" targetRef="ServiceTask_CheckInventory" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="ServiceTask_CheckInventory" targetRef="Gateway_Stock" />
    <bpmn:sequenceFlow id="Flow_6" name="是" sourceRef="Gateway_Stock" targetRef="UserTask_PrepareGoods">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${"${stock > 0}"}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_7" name="否" sourceRef="Gateway_Stock" targetRef="ServiceTask_Restock">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${"${stock == 0}"}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_8" sourceRef="UserTask_PrepareGoods" targetRef="Gateway_Merge" />
    <bpmn:sequenceFlow id="Flow_9" sourceRef="ServiceTask_Restock" targetRef="Gateway_Merge" />
    <bpmn:sequenceFlow id="Flow_10" sourceRef="Gateway_Merge" targetRef="ParallelGw_Split" />
    <bpmn:sequenceFlow id="Flow_11" sourceRef="ParallelGw_Split" targetRef="ServiceTask_GenLabel" />
    <bpmn:sequenceFlow id="Flow_12" sourceRef="ParallelGw_Split" targetRef="ManualTask_Package" />
    <bpmn:sequenceFlow id="Flow_13" sourceRef="ServiceTask_GenLabel" targetRef="ParallelGw_Join" />
    <bpmn:sequenceFlow id="Flow_14" sourceRef="ManualTask_Package" targetRef="ParallelGw_Join" />
    <bpmn:sequenceFlow id="Flow_15" sourceRef="ParallelGw_Join" targetRef="ServiceTask_Ship" />
    <bpmn:sequenceFlow id="Flow_16" sourceRef="ServiceTask_Ship" targetRef="IntermediateThrowEvent_Shipped" />
    <bpmn:sequenceFlow id="Flow_17" sourceRef="IntermediateThrowEvent_Shipped" targetRef="EndEvent_Done" />
    <bpmn:sequenceFlow id="Flow_ToEnd2" sourceRef="SendTask_Notify" targetRef="EndEvent_Done" />

    <!-- ===== 关联（Associations） ===== -->
    <bpmn:association id="Assoc_1" sourceRef="Annotation_1" targetRef="StartEvent_1" />
    <bpmn:association id="Assoc_2" sourceRef="Annotation_2" targetRef="ServiceTask_Ship" />
  </bpmn:process>

  <!-- ===== 图形交换信息（BPMNDiagram） ===== -->
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">

      <!-- Pool -->
      <bpmndi:BPMNShape id="Pool_OrderProcess_di" bpmnElement="Pool_OrderProcess" isHorizontal="true">
        <dc:Bounds x="40" y="40" width="1260" height="700" />
      </bpmndi:BPMNShape>

      <!-- Lanes -->
      <bpmndi:BPMNShape id="Lane_Sales_di" bpmnElement="Lane_Sales" isHorizontal="true">
        <dc:Bounds x="70" y="40" width="1230" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Warehouse_di" bpmnElement="Lane_Warehouse" isHorizontal="true">
        <dc:Bounds x="70" y="240" width="1230" height="220" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Logistics_di" bpmnElement="Lane_Logistics" isHorizontal="true">
        <dc:Bounds x="70" y="460" width="1230" height="280" />
      </bpmndi:BPMNShape>

      <!-- 开始事件 -->
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="120" y="122" width="36" height="36" />
      </bpmndi:BPMNShape>

      <!-- 销售部节点 -->
      <bpmndi:BPMNShape id="UserTask_ReceiveOrder_di" bpmnElement="UserTask_ReceiveOrder">
        <dc:Bounds x="210" y="110" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_OrderCheck_di" bpmnElement="Gateway_OrderCheck">
        <dc:Bounds x="365" y="115" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="UserTask_ConfirmOrder_di" bpmnElement="UserTask_ConfirmOrder">
        <dc:Bounds x="470" y="110" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SendTask_Notify_di" bpmnElement="SendTask_Notify">
        <dc:Bounds x="470" y="180" width="100" height="60" />
      </bpmndi:BPMNShape>

      <!-- 仓储部节点 -->
      <bpmndi:BPMNShape id="ServiceTask_CheckInventory_di" bpmnElement="ServiceTask_CheckInventory">
        <dc:Bounds x="210" y="310" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Stock_di" bpmnElement="Gateway_Stock">
        <dc:Bounds x="365" y="315" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="UserTask_PrepareGoods_di" bpmnElement="UserTask_PrepareGoods">
        <dc:Bounds x="470" y="270" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ServiceTask_Restock_di" bpmnElement="ServiceTask_Restock">
        <dc:Bounds x="470" y="380" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_Merge_di" bpmnElement="Gateway_Merge">
        <dc:Bounds x="625" y="315" width="50" height="50" />
      </bpmndi:BPMNShape>

      <!-- 物流部节点 -->
      <bpmndi:BPMNShape id="ParallelGw_Split_di" bpmnElement="ParallelGw_Split">
        <dc:Bounds x="210" y="565" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ServiceTask_GenLabel_di" bpmnElement="ServiceTask_GenLabel">
        <dc:Bounds x="320" y="510" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ManualTask_Package_di" bpmnElement="ManualTask_Package">
        <dc:Bounds x="320" y="620" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ParallelGw_Join_di" bpmnElement="ParallelGw_Join">
        <dc:Bounds x="475" y="565" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ServiceTask_Ship_di" bpmnElement="ServiceTask_Ship">
        <dc:Bounds x="580" y="560" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="IntermediateThrowEvent_Shipped_di" bpmnElement="IntermediateThrowEvent_Shipped">
        <dc:Bounds x="732" y="572" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_Done_di" bpmnElement="EndEvent_Done">
        <dc:Bounds x="832" y="572" width="36" height="36" />
      </bpmndi:BPMNShape>

      <!-- 数据元素 -->
      <bpmndi:BPMNShape id="DataObject_Order_di" bpmnElement="DataObject_Order">
        <dc:Bounds x="332" y="60" width="36" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="DataStore_Inventory_di" bpmnElement="DataStore_Inventory">
        <dc:Bounds x="127" y="325" width="50" height="50" />
      </bpmndi:BPMNShape>

      <!-- 注释 -->
      <bpmndi:BPMNShape id="Annotation_1_di" bpmnElement="Annotation_1">
        <dc:Bounds x="100" y="60" width="120" height="40" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Annotation_2_di" bpmnElement="Annotation_2">
        <dc:Bounds x="580" y="500" width="100" height="30" />
      </bpmndi:BPMNShape>

      <!-- 顺序流连线 -->
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="156" y="140" />
        <di:waypoint x="210" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="310" y="140" />
        <di:waypoint x="365" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="415" y="140" />
        <di:waypoint x="470" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Reject_di" bpmnElement="Flow_Reject">
        <di:waypoint x="390" y="165" />
        <di:waypoint x="390" y="210" />
        <di:waypoint x="470" y="210" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="520" y="170" />
        <di:waypoint x="520" y="240" />
        <di:waypoint x="260" y="240" />
        <di:waypoint x="260" y="310" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="310" y="340" />
        <di:waypoint x="365" y="340" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="390" y="315" />
        <di:waypoint x="390" y="300" />
        <di:waypoint x="470" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7">
        <di:waypoint x="390" y="365" />
        <di:waypoint x="390" y="410" />
        <di:waypoint x="470" y="410" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8">
        <di:waypoint x="570" y="300" />
        <di:waypoint x="650" y="300" />
        <di:waypoint x="650" y="315" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_9_di" bpmnElement="Flow_9">
        <di:waypoint x="570" y="410" />
        <di:waypoint x="650" y="410" />
        <di:waypoint x="650" y="365" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_10_di" bpmnElement="Flow_10">
        <di:waypoint x="650" y="365" />
        <di:waypoint x="650" y="460" />
        <di:waypoint x="235" y="460" />
        <di:waypoint x="235" y="565" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_11_di" bpmnElement="Flow_11">
        <di:waypoint x="235" y="615" />
        <di:waypoint x="235" y="540" />
        <di:waypoint x="320" y="540" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_12_di" bpmnElement="Flow_12">
        <di:waypoint x="260" y="590" />
        <di:waypoint x="290" y="650" />
        <di:waypoint x="320" y="650" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_13_di" bpmnElement="Flow_13">
        <di:waypoint x="420" y="540" />
        <di:waypoint x="500" y="540" />
        <di:waypoint x="500" y="565" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_14_di" bpmnElement="Flow_14">
        <di:waypoint x="420" y="650" />
        <di:waypoint x="500" y="650" />
        <di:waypoint x="500" y="615" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_15_di" bpmnElement="Flow_15">
        <di:waypoint x="525" y="590" />
        <di:waypoint x="580" y="590" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_16_di" bpmnElement="Flow_16">
        <di:waypoint x="680" y="590" />
        <di:waypoint x="732" y="590" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_17_di" bpmnElement="Flow_17">
        <di:waypoint x="768" y="590" />
        <di:waypoint x="832" y="590" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ToEnd2_di" bpmnElement="Flow_ToEnd2">
        <di:waypoint x="570" y="210" />
        <di:waypoint x="850" y="210" />
        <di:waypoint x="850" y="572" />
      </bpmndi:BPMNEdge>

      <!-- 关联连线 -->
      <bpmndi:BPMNEdge id="Assoc_1_di" bpmnElement="Assoc_1">
        <di:waypoint x="140" y="100" />
        <di:waypoint x="138" y="122" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Assoc_2_di" bpmnElement="Assoc_2">
        <di:waypoint x="630" y="530" />
        <di:waypoint x="630" y="560" />
      </bpmndi:BPMNEdge>

    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>

</bpmn:definitions>`
