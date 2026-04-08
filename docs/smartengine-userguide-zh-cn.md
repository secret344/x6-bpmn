# Overview
SmartEngine 是一款业务治理和服务编排引擎。业务治理引擎专注于解决互联网场景下和传统工作流行业的流程相关问题，服务编排引擎专注于用统一的标准来解决复杂链路服务上的服务编排问题。

# Getting Started

## Custom vs DataBase 

SmartEngine 区别于传统的流程引擎，提供了两种模式供用户选择。

DataBase 模式聚焦于服务于传统的审批流场景，比如说传统的请假，审批，会签(并发会签和顺序会签)场景。 这些场景下，一般对于数据的范式查询，待办列表有着大量的诉求。 一般而言，这种场景的工单实例数据规模不会特别大。

Custom 模式聚焦于服务于高并发海量数据低成本的业务流程治理以及针对微服务架构体系下的服务编排。针对前者的话，经典场景如请求密集型的互联网业务，这种业务对高并发和存储成本比较敏感。 针对后者的话，我们支持和Spring，HSF体系无缝集成，方便用户高效去编排各种微服务。 通过服务编排，可以业务带来更多的可视化，帮助相关人理解业务和系统。

## 要求软件

* JDK6+

## 背景知识

### BPMN 示例片段

```
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns:smart="http://smartengine.org/schema/process" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="Examples">

    <process id="exclusiveTest" version="1.0.0">

        <startEvent id="theStart">
        </startEvent>

        <sequenceFlow id="flow1" sourceRef="theStart" targetRef="submitTask"/>

        <userTask id="submitTask" name="SubmitTask">
        </userTask>

        <sequenceFlow id="flowFromSubmitTask" sourceRef="submitTask" targetRef="auditTask"/>

        <userTask id="auditTask" name="AuditTask">
        </userTask>

        <sequenceFlow id="flowFromAuditTask" sourceRef="auditTask" targetRef="exclusiveGw1"/>


        <exclusiveGateway id="exclusiveGw1" name="Exclusive Gateway 1"/>

        <sequenceFlow id="flow2" sourceRef="exclusiveGw1"
                      targetRef="executeTask">
            <conditionExpression xsi:type="mvel">approve == 'agree'
            </conditionExpression>
        </sequenceFlow>

        <sequenceFlow id="flow3" sourceRef="exclusiveGw1"
                      targetRef="advancedAuditTask">
            <conditionExpression xsi:type="mvel">approve == 'upgrade'
            </conditionExpression>
        </sequenceFlow>


        <serviceTask id="executeTask" name="ExecuteTask"
                     smart:class="com.alibaba.simplest.bpm.util.AuditProcessServiceTaskDelegation">
        </serviceTask>


        <sequenceFlow id="flow5" sourceRef="executeTask" targetRef="theEnd"/>


        <userTask id="advancedAuditTask" name="AdvancedAuditTask">
        </userTask>

        <sequenceFlow id="flowFromAdvancedAuditTask" sourceRef="advancedAuditTask"
                      targetRef="exclusiveGw2"/>

        <exclusiveGateway id="exclusiveGw2" name="Exclusive Gateway 2"/>

        <sequenceFlow id="flow9" sourceRef="exclusiveGw2"
                      targetRef="executeTask">
            <conditionExpression type="mvel">approve == 'agree'
            </conditionExpression>
        </sequenceFlow>

        <sequenceFlow id="flow10" sourceRef="exclusiveGw2"
                      targetRef="theEnd">
            <conditionExpression type="mvel">approve == 'deny'
            </conditionExpression>
        </sequenceFlow>

        <endEvent id="theEnd"/>

    </process>

</definitions>
```

### 流程定义解释说明

1. `process`,表示一个流程。
2. `id="exclusiveTest" version="1.0.0"`,分别表示流程定义的id和版本。这两个字段唯一区分一个流程定义。
1. `startEvent`，表示流程开始节点。只允许有一个开始节点。
3. `endEvent `，表示流程结束节点。可以有多个结束节点。
4. `sequenceFlow `，表示环节流转关系。`sourceRef="theStart" targetRef="submitTask"` 分别表示起始节点和目标节点。该节点有个子节点，` <conditionExpression type="mvel">approve == 'agree'  </conditionExpression>`,这个片段很重要,用来描述流程流转的条件.`approve == 'upgrade'`使用的是MVEL表达式语法. 另外,还值得注意的是,在驱动流程运转时,需要传入正确的参数。 比如说，在后面介绍的api中，通常会需要在Map中传递业务请求参数。 那么需要将map中的key 和 Mvel的运算因子关联起来。 以这个例子来说， `  request.put("approve", "agree");` 里面的approve 和  `approve == 'agree' ` 命名要一致。
6. `exclusiveGateway `，表示互斥网关。该节点非常重要。用来区分流程节点的不同转向。 互斥网关在引擎执行`conditionExpression ` 后，有且只能选择一条匹配的sequenceFlow 继续执行。
7. `serviceTask`，服务任务，用来表示执行一个服务,所以他会有引擎默认的扩展:`smart:class="com.alibaba.smart.framework.example.AuditProcessServiceTaskDelegation"`. Client Developer使用时,需要自定义对应的业务实现类。在该节点执行时，它会自动执行服务调用，执行 smart:class 这个 delegation 。 该节点不暂停，会自动往下一个流转。
8. `receiveTask `，接收任务。在引擎遇到此类型的节点时，引擎执行会自动暂停，等待外部调用`signal`方法。 当调用`signal`方法时，会驱动流程当前节点离开。 在离开该节点时，引擎会自动执行 smart:class 这个 delegation。 在一般业务场景中，我们通常使用receiveTask来表示等需要等待外部回调的节点。 
7. `userTask `，表示用户任务节点，仅用于DataBase模式。该节点需要人工参与处理，并且通常需要在待办列表中展示。 在Custom 模式下，建议使用`receiveTask`来代替。
8. `parallelGateway`，这个节点并未在上述流程定义中体现，这里详细说一下。 `parallelGateway` 首先必须成对出现，分别承担fork 和join 职责。 其次，在join时需要实现分布式锁接口：`LockStrategy`。第三，fork 默认是顺序遍历多个`sequeceFlow`,但是你如果需要使用并发fork功能的话，则需要实现该接口：`ExecutorService`。


### API DOC
1. 整体风格是类似CQRS(Command Query Responsibility Segregation)的,主要对外API见`api`模块下的两个package: `com.alibaba.smart.framework.engine.service.command` ,`com.alibaba.smart.framework.engine.service.query`
1. `SmartEngine` 是核心Facade类，所有流程引擎相关的服务都可以从该类中获取。
1. `ProcessEngineConfiguration` 是引擎初始化的配置类。这个类有几个重要的相关类，详细介绍如下：

   2. `InstanceAccessor`：必须实现该接口。该接口主要用于获取业务的Delegation对象。在生产环境中，强烈建议结合Spring 获取这个Bean，后文会有示例代码。
   3. `DefaultDelegationExecutor`: 一般不需要扩展，这个主要服务于高级扩展特性。该类允许客户重新定义Delegation的执行和异常处理机制。 
   4. `AnnotationScanner`: 一般不需要扩展，这个主要服务于高级扩展特性。该类允许客户重新替换对应Annotation下扩展类实现。
   3. `ExceptionProcessor`:默认不需要扩展，业务根据需要进行扩展。该类主要用于处理Delegation执行时的异常处理逻辑。
   4. `TaskAssigneeDispatcher`:仅用于DataBase模式。必须实现该接口。 在传统工作流里面，需要设置任务的处理者时，则需要这个接口，后文会有示例代码。
   5. `VariablePersister`: 仅用于DataBase模式。默认不需要扩展，业务根据需要进行扩展。该类支持根据选定的序列化方式，自动存储 command 里面的 request 参数，同时支持黑名单机制。
   6. `MultiInstanceCounter`:仅用于DataBase模式，主要用于会签场景。后文会有示例代码。
   7. `ExecutorService`: 默认不需要扩展，业务根据需要进行扩展。该类主要服务于并行网关。该实现该接口时，并行网关的fork 将从顺序执行模式转为并发执行模式。
   7. `IdGenerator`:建议结合 分布式id 生成器来实现这个接口。需要注意的是，自2.6.4版本后，在获取id后，需要在实现类里，手动给instance的id赋值。
2. `RepositoryCommandService` :流程定义部署，将流程定义文件解析到单机内存中。
3. `RepositoryQueryService`: 获取单机中的内存中的流程定义。
4. `DeploymentCommandService`: 将流程定义文件持久化到 数据库里面，并负责调用 RepositoryCommandService 完成解析。
5. `DeploymentQueryService`: 获取存储到DB中流程定义内容。
3. `ProcessCommandService` : 流程实例管理服务，不包括流程实例启动，终止等等。
4. `ProcessQueryService` : 流程实例查询服务。
5. `ActivityQueryService` : 活动实例查询服务。
6. `ExecutionCommandService` : 驱动引擎流转服务,主要支持signal，markDone，jump和retry 等。 该服务区别于 TaskCommandService，主要负责驱动  ReceiveTask 这样暂停型的节点。
7. `ExecutionQueryService` : 执行实例查询服务。
7. `TaskCommandService` : 主要负责人工任务处理服务，主要支持transfer，markDone，add/remove TaskAssigneeCandidate。在`TaskCommandService`内部实现中，调用了`ExecutionCommandService `方法。 该类仅用于DataBase模式。
6. `TaskQueryService` : 任务实例查询服务。
4. `VariableQueryService` : 变量实例查询服务。
5. `TaskAssigneeQueryService` : 主要负责查询人工任务的处理者。仅用于DataBase模式。

### 重要领域对象
0. 部署实例: `DeploymentInstance`，描述这个流程定义是谁发布的，当前处于什么状态。
1. 流程定义: `ProcessDefinition`, 描述一个流程有几个环节,之间的流转关系是什么样子的。
2. 流程实例: `ProcessInstance`,可以简单理解为我们常见的一个工单。
3. 活动实例: `ActivityInstance`,主要是描述流程实例（工单）的流转轨迹。
4. 执行实例: `ExecutionInstance`,主要根据该实例的状态，来判断当前流程处在哪个节点上。 
5. 任务实例: `TaskInstance`,用来表示人工任务处理的.可以理解为一个需要人工参与处理的环节。
6. 任务处理：`TaskAssigneeInstance`,用来表示当前任务共有几个处理者。通常在代办列表中用到此实体。
7. 变量实例：`VariableInstance`,用来存储流程实例上下文。

### 关键类
0. `ExecutionContext`: `getExecutionInstance()` 方法可以通过这个对象获得当前环节的id；`getBaseElement()` 方法可以通过这个对象获得当前环节的id的流程定义配置；`getRequest()` 方法可以获得业务请求参数；`getResponse()` 方法设置返回值；`getProcessDefinition()` 方法可以获得完成的流程定义；


### 其他常见特性说明

#### 并行网关
并行网关的 fork,join 网关需要成对出现. 
并行网关通常运行在多线程环境,进行并发 fork,有助于明显提升流程执行效率.

a. 初始化线程池,根据需要也自定义

```
        CustomThreadFactory threadFactory = new CustomThreadFactory("smart-engine");
        processEngineConfiguration.setExecutorService( Executors.newFixedThreadPool(30, threadFactory));
```
b. 自定义线程工厂

```
    static class CustomThreadFactory implements ThreadFactory {
        private final AtomicInteger threadNumber = new AtomicInteger(1);
        private final String namePrefix;

        CustomThreadFactory(String poolName) {
            namePrefix = poolName + "-thread-";
        }

        @Override
        public Thread newThread(Runnable r) {
            Thread thread = new Thread(r, namePrefix + threadNumber.getAndIncrement());
            thread.setDaemon(false); // 设置为非守护线程
            return thread;
        }
    }
```

#### 包容网关
包容网关是互斥网关和并行网关的结合体。包容网关支持普通包容网关,嵌套网关和 Unbalanced 包容网关. 由于包容网关需要记录下在 fork 阶段触发的分支(存储在变量表里),所以该模式仅支持 DataBase 模式. 所以这里的注意点是:

a. 实现序列化接口:

详细实现可以参考这个: `src/test/java/com/alibaba/smart/framework/engine/test/process/helper/CustomVariablePersister.java`

```
    @Override
    public Object deserialize(String key, String type, String value) {
        if(key.contains(TRIGGER_ACTIVITY_IDS)){
            return  JSON.parseArray(value,String.class);
        }
        return  JSON.parseObject(value);

    }
```

其他方面,包容网关就和互斥网关特性一样,在对应的分支设置条件; SE 在 join 时,会根据实际触发的分支数量来进行计算对应逻辑.


b. 包容网关和互斥网关一样,也顺带支持了 Default SequenceFlow 特性.

```
        <inclusiveGateway id="inclusiveFork" name="包容网关分叉"  default="flow2"/>

```
当所有分支都未被触发时,可以选择`default="flow2"` 这个分支来流转.

#### Properties：

可以在流程定义的环节中，制定环节的扩展属性。Properties 支持3个属性，type,name,value. type和name相当于联合主键，便于在复杂场景完成不同意图的配置。 完整的Test 可以查看这个Test:`SmartPropertiesTest`。
 
  a. 流程定义代码片段如下：
	
```
<serviceTask id="ServiceTask_056ab4g" name="Right"
                     smart:class="com.alibaba.smart.framework.engine.test.delegation.RightJavaDelegation">
            <extensionElements>
                <smart:properties>
                    <smart:property name="value" value="right"/>
                </smart:properties>
            </extensionElements>
        </serviceTask>

```
  b. 获取指定property代码片段如下：


```


String processDefinitionActivityId =  executionContext.getExecutionInstance().getProcessDefinitionActivityId();

ExtensionElementContainer idBasedElement = (ExtensionElementContainer)executionContext.getProcessDefinition().getIdBasedElementMap().get(
    processDefinitionActivityId);

ExtensionElements extensionElements = idBasedElement.getExtensionElements();

Map map = (Map)extensionElements.getDecorationMap().get(
        ExtensionElementsConstant.PROPERTIES);

Assert.assertEquals("right", map.get(new PropertyCompositeKey("value")).getValue());


```

####  ExecutionListener

支持ACTIVITY_START，ACTIVITY_END,完整实例查看代码里的`SmartPropertiesTest ` 这个测试类。事件的含义：ACTIVITY_START，进入节点时；ACTIVITY_END，离开节点时。 流程定义示例如下：
	
```
<serviceTask id="ServiceTask_056ab4g" name="Right"
                     smart:class="com.alibaba.smart.framework.engine.test.delegation.RightJavaDelegation">
            <extensionElements>
                <smart:executionListener event="ACTIVITY_START,ACTIVITY_END"
                                         class="com.alibaba.smart.framework.engine.test.StartListener"/>
            </extensionElements>
        </serviceTask>

```


####  GatewayDelegation：

该特性支持在互斥网关设置smart:class属性，具体可以查看`AdvancedExclusvieGatewayProcessTest`这个test。 流程定义片段如下：

```

<exclusiveGateway id="exclusiveGateway" smart:class="com.alibaba.smart.framework.engine.test.delegation.ExclusiveGatewayDelegation"/>

```

####  IdGenerator

SmartEngine需要客户自己实现一个Id生成器，示例代码如下。 简单的生成器一般可以基于DataBase的Sequence来生成。

OK，以上基本完成常见功能的介绍。 后面会重点如何介入Custom 模式和DataBase 模式。


## 应用接入
### 通用知识

无论是使用Custom 还是DataBase 模式，以下均是必须了解的知识。 

1. 第一步，要选择正确的SmartEngine 版本和合适的slf4j版本，将其添加到pom依赖中。
2. 第二步，要实现`InstanceAccessor`接口。 这个接口主要便于SmartEngine和Spring等IOC框架集成，获取各种微服务的bean。  SmartEngine 会根据流程定义中的`smart:class`属性值，在结合`InstanceAccessor`的实现类，去调用Delegation。值得一提的是，`smart:class` 的属性值可以使className 或者 beanName，只要在逻辑上和`InstanceAccessor`的实现类保持一致即可。
3. 第三步，完成SmartEngine初始化。在初始化时，一般要加载流程定义到应用中。 集群情况下，要注意流程定义的一致性（如果纯静态记载则无此类问题）。  在初始化时，可以根据需要定义Bean的加载优先级。  典型的初始化代码如下。

```
package com.alibaba.smart.framework.engine.starter;

import java.io.InputStream;

import com.alibaba.smart.framework.engine.SmartEngine;
import com.alibaba.smart.framework.engine.configuration.InstanceAccessor;
import com.alibaba.smart.framework.engine.configuration.ProcessEngineConfiguration;
import com.alibaba.smart.framework.engine.configuration.impl.DefaultProcessEngineConfiguration;
import com.alibaba.smart.framework.engine.configuration.impl.DefaultSmartEngine;
import com.alibaba.smart.framework.engine.exception.EngineException;
import com.alibaba.smart.framework.engine.service.command.RepositoryCommandService;
import com.alibaba.smart.framework.engine.util.IOUtil;

import org.springframework.beans.BeansException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import static org.springframework.core.Ordered.LOWEST_PRECEDENCE;

@Order(LOWEST_PRECEDENCE)
@Configuration
@ConditionalOnClass(SmartEngine.class)
public class SmartEngineAutoConfiguration implements ApplicationContextAware {

    private ApplicationContext applicationContext;

    @Bean
    @ConditionalOnMissingBean
    public SmartEngine constructSmartEngine() {
        ProcessEngineConfiguration processEngineConfiguration = new DefaultProcessEngineConfiguration();
        processEngineConfiguration.setInstanceAccessor(new CustomInstanceAccessService());

        SmartEngine smartEngine = new DefaultSmartEngine();
        smartEngine.init(processEngineConfiguration);

        deployProcessDefinition(  smartEngine);

        return smartEngine;
    }

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        this.applicationContext = applicationContext;
    }

    private class CustomInstanceAccessService implements InstanceAccessor {
        @Override
        public Object access(String name) {
            return  applicationContext.getBean(name);
        }

    }


    private void deployProcessDefinition(SmartEngine smartEngine) {
        RepositoryCommandService repositoryCommandService = smartEngine
            .getRepositoryCommandService();

        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        try {
            Resource[] resources = resolver.getResources("classpath*:/smart-engine/*.xml");
            for (Resource resource : resources) {
                InputStream inputStream = resource.getInputStream();
                repositoryCommandService.deploy(inputStream);
                IOUtil.closeQuietly(inputStream);
            }
        } catch (Exception e) {
            throw new EngineException(e);
        }

    }
}

```


## Custom Pattern


### 添加POM依赖
```
<dependency>
    <groupId>com.alibaba.smart.framework</groupId>
    <artifactId>smart-engine-extension-storage-custom</artifactId>
    <version>3.0.0</version>
</dependency>

```

### 应用系统集成 SmartEgnine

Custom 模式支持持久化流程实例数据和不持久化流程实例数据。 通常针对服务编排场景，是不需要持久化流程实例相关信息的；但是如果是简易流程，需要暂停后并恢复继续执行的，则需要考虑持久化流程实例到存储介质里。

在如下这个代码片段中，需要重点关注如下事项：

1.  Custom 模式必须在 try,finally块中使用 `PersisterSession.create()`和 `PersisterSession.destroySession() `。  SmartEngine 内部执行时，会依赖该Session，从该session获取流程实例数据。
3. `mockCreateOrder`：模拟启动流程实例。然后将流程实例序列化一个字符串后，存储到你持久化介质中。
4. `signal`:模拟驱动业务流程。该过程和启动流程实例类似，都是将signal返回的流程实例序列化后更新到持久化介质中，然后在需要使用的时候，再取出来。
5. `BusinessProcess` 这个类仅是个示例，服务编排场景忽略这种代码即可。 在生产代码中，ClientDevloper 可以自行选择适合的存储介质和存储形式。 
6. 另外，ClientDevloper 也可以不使用内置的`InstanceSerializerFacade`工具类，可以选择自己认为更有效的序列化/反序列化工具。

```

public  void mockCreateOrder(){

       try {
           PersisterSession.create();

       Map<String, Object> request = new HashMap<>();
       request.put(ProcessConstant.ENGINE_ACTION,"create_action");

       ProcessCommandService processCommandService = smartEngine.getProcessCommandService();
       ProcessInstance processInstance= processCommandService.start("exclusiveTest","1.0.0",request);

       //服务编排场景可以忽略掉这段代码 START
       BusinessProcess  businessProcess = new BusinessProcess();
       businessProcess.setId(id);
       String serializedProcessInstance = InstanceSerializerFacade.serialize(processInstance);
       businessProcess.setSerializedProcessInstance(serializedProcessInstance);

       businessProcessService.addBusinessProcess(businessProcess);

       //服务编排场景可以忽略掉这段代码 END

       } finally {
           PersisterSession.destroySession();
       }
   }

   public void signal(Long businessInstanceId, String activityId,Map<String, Object>   map ){
       try {
           PersisterSession.create();

           ExecutionQueryService executionQueryService = smartEngine.getExecutionQueryService();
           ExecutionCommandService executionCommandService = smartEngine.getExecutionCommandService();

           BusinessProcess businessProcess = businessProcessService.findById(businessInstanceId);
           ProcessInstance processInstance =  InstanceSerializerFacade.deserializeAll(businessProcess.getSerializedProcessInstance());

           PersisterSession.currentSession().setProcessInstance(processInstance);

           List<ExecutionInstance>  executionInstanceList =executionQueryService.findActiveExecutionList(processInstance.getInstanceId());
           boolean found = false;
           if(!CollectionUtils.isEmpty(executionInstanceList)){
               for (ExecutionInstance executionInstance : executionInstanceList) {
                   if( executionInstance.getProcessDefinitionActivityId().equals(activityId)){
                       found = true;

                       ProcessInstance newProcessInstance = executionCommandService.signal(executionInstance.getInstanceId(),map);

                       BusinessProcess  businessProcess = new BusinessProcess();
                       String serializedProcessInstance = InstanceSerializerFacade.serialize(newProcessInstance);
                       businessProcess.setSerializedProcessInstance(serializedProcessInstance);

                       businessProcessService.updateBusinessProcess(businessProcess);

                   }
               }
               if(!found){
                   LOGGER.error("No active executionInstance found for businessInstanceId "+businessInstanceId +",activityId "+activityId);
               }

           }else{
               LOGGER.error("No active executionInstance found for businessInstanceId "+businessInstanceId +",activityId "+activityId);
           }

       } finally {
           PersisterSession.destroySession();
       }
   }
```
## 服务编排
1. 这里简单说下我眼中的服务编排通俗版定义。 服务编排通常是指意指服务串联方式，特别是指复杂的分布式业务场景中，一次业务请求，需要先后调用各种应用服务。 最原始的服务编排就是一行一行硬编码，调用各个应用服务。 结合SmartEngine的话，就是主要使用StartEvent,EndEvent,ExclusiveGateway,ServiceTask等节点来串联各个应用服务端执行，进而达到可视化可配置。 针对fork，join这种业务场景， SmartEngine针对并行网关下服务编排做了特别增强，支持通过并行网关支持并发fork，join。 详细的例子可以看下这个test：`ServiceOrchestrationParallelGatewayTest`。   核心代码如下：

```
//1. 指定线程池
processEngineConfiguration.setExecutorService(blabla);
//2. 开启服务编排
processEngineConfiguration.getOptionContainer().put(ConfigurationOption.SERVICE_ORCHESTRATION_OPTION);

```




## 其他补充说明
1. 目前在 Custom 模式中，推荐使用一个扩展字段来存储流程实例的状态。默认情况下，这个格式是这样的
`v1|4333,processDefinitionId:1.0.0,null,null,running|5033,null,WaitPayCallBackActivity,5133,true,|`。 这个字符串的顺序依次是：序列化协议版本号，分隔符，流程实例，流程定义 id 和 version，父流程实例 id，父流程实例的执行实例 id，流程状态，分割符，（注释：后面是环节信息，可以有多个，用|分开）,环节实例 id，环节实例 blockId(可忽略)，执行实例 id，执行实例状态，分隔符


## DataBase Pattern


### 添加POM依赖以及对应的 slf4j
```
<dependency>
    <groupId>com.alibaba.smart.framework</groupId>
    <artifactId>smart-engine-extension-storage-mysql</artifactId>
    <version>3.0.0</version>
</dependency>

```

### 添加包扫描路径

```
    <context:component-scan base-package="com.alibaba.smart.framework.engine.persister"/>
    
    <!-- Mapper接口所在包名，Spring会自动查找其下的Mapper -->
    <bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
        <property name="basePackage" value="com.alibaba.smart.framework.engine.persister.database" />
    </bean>
```


### 建表语句
见引擎源码：https://github.com/alibaba/SmartEngine 中的 schema.sql

### API使用
使用上基本和 Custom 模式一致，但是不用关心在 try，finally 块中处理 session。

### DataBase 特色功能

#### UserTask：

如上文所说，`UserTask`是DataBase模式下特有的功能。 `UserTask`和`TaskAssigneeDispatcher`，待办列表（`TaskInstance`）紧密关联。 通过`TaskAssigneeDispatcher`，可以实现自动获取某个节点的任务处理者。简单的示例代码如下，实际生产系统中，Client Developer 可以从request中获取，也可以从其他配置系统中获取任务处理者。 在非会签场景，一个userTask 会仅创建一个`TaskInstance`以及若干`TaskAssigneeInstance`。任何一个任务处理者完成任务后（一般是调用TaskCommandService#complete方法），都会将流程往下一个节点推进。 会签场景后续章节会接着解释。

```
public class DefaultTaskAssigneeDispatcher implements TaskAssigneeDispatcher {

    @Override
    public List<TaskAssigneeCandidateInstance> getTaskAssigneeCandidateInstance(Activity activity,Map<String,Object> request) {
        List<TaskAssigneeCandidateInstance> taskAssigneeCandidateInstanceList= new ArrayList<TaskAssigneeCandidateInstance>();

        TaskAssigneeCandidateInstance taskAssigneeCandidateInstance = new TaskAssigneeCandidateInstance();
        taskAssigneeCandidateInstance.setAssigneeId("1");
        taskAssigneeCandidateInstance.setAssigneeType(AssigneeTypeConstant.USER);
        taskAssigneeCandidateInstanceList.add(taskAssigneeCandidateInstance);

        TaskAssigneeCandidateInstance taskAssigneeCandidateInstance1 = new TaskAssigneeCandidateInstance();
        taskAssigneeCandidateInstance1.setAssigneeId("3");
        taskAssigneeCandidateInstance1.setAssigneeType(AssigneeTypeConstant.USER);
        taskAssigneeCandidateInstanceList.add(taskAssigneeCandidateInstance1);


        TaskAssigneeCandidateInstance taskAssigneeCandidateInstance2 = new TaskAssigneeCandidateInstance();
        taskAssigneeCandidateInstance2.setAssigneeId("5");
        taskAssigneeCandidateInstance2.setAssigneeType(AssigneeTypeConstant.USER);
        taskAssigneeCandidateInstanceList.add(taskAssigneeCandidateInstance2);


        return taskAssigneeCandidateInstanceList;
    }



}


```

#### 特殊变量

由于业务场景的复杂性，SmartEngine DataBase内置了一些特殊key，用于支持常见的业务需求。 比如说，一般任务实例中都会标题等之类的字段。 在SmartEngine 中，你需要在request 这个map中，将值传给引擎 。支持的特殊key如下：

```
public class RequestMapSpecialKeyConstant {

    public static final String $_SMART_ENGINE_$_PREFIX = "_$_smart_engine_$_";

    public static final String PROCESS_DEFINITION_TYPE = $_SMART_ENGINE_$_PREFIX + "process_definition_type";

    public static final String PROCESS_INSTANCE_START_USER_ID = $_SMART_ENGINE_$_PREFIX + "start_user_id";

    public static final  String TASK_START_TIME = $_SMART_ENGINE_$_PREFIX + "task_start_time";

    public static final  String TASK_COMPLETE_TIME = $_SMART_ENGINE_$_PREFIX + "task_complete_time";


    public static final  String TASK_INSTANCE_TAG = $_SMART_ENGINE_$_PREFIX + "task_instance_tag";

    public static final  String TASK_INSTANCE_EXTENSION = $_SMART_ENGINE_$_PREFIX + "task_instance_extension";

    public static final  String TASK_INSTANCE_PRIORITY = $_SMART_ENGINE_$_PREFIX + "task_instance_priority";

    public static final  String TASK_TITLE = $_SMART_ENGINE_$_PREFIX + "task_title";

    public static final  String TASK_INSTANCE_CLAIM_USER_ID = $_SMART_ENGINE_$_PREFIX + "TASK_INSTANCE_CLAIM_USER_ID";

    public static final  String TASK_INSTANCE_COMMENT = $_SMART_ENGINE_$_PREFIX + "TASK_INSTANCE_COMMENT";

    public static final  String PROCESS_BIZ_UNIQUE_ID = $_SMART_ENGINE_$_PREFIX + "biz_unique_id";

    public static final  String PROCESS_TITLE = $_SMART_ENGINE_$_PREFIX + "PROCESS_TITLE";

    public static final  String PROCESS_INSTANCE_COMMENT = $_SMART_ENGINE_$_PREFIX + "PROCESS_INSTANCE_COMMENT";

    public static final  String PROCESS_INSTANCE_ABORT_REASON = $_SMART_ENGINE_$_PREFIX + "PROCESS_INSTANCE_ABORT_REASON";

    public static final  String CLAIM_USER_ID = $_SMART_ENGINE_$_PREFIX + "claimUserId";

    public static final  String CLAIM_USER_TIME = $_SMART_ENGINE_$_PREFIX + "claimUserTime";


}


```

#### 变量表

针对一些简单业务场景，需要支持将request中key 存储到db中。 SmartEngine提供了默认的机制，帮助业务存储一些简单键值对。

```

/**
 * Created by 高海军 帝奇 74394 on 2017 October  
 */
public class CustomVariablePersister implements VariablePersister {
    private static final Logger LOGGER = LoggerFactory.getLogger(CustomVariablePersister.class);

    private static  Set<String> blockSet = new HashSet();

   static {

       try {
           Field[] declaredFields = RequestMapSpecialKeyConstant.class.getDeclaredFields();
           for (Field declaredField : declaredFields) {
               String key= (String)declaredField.get(declaredField.getName());
               blockSet.add(key);
           }
       } catch (IllegalAccessException e) {
           LOGGER.error(e.getMessage(),e);
       }

        //do something else.
       blockSet.add("text");
   }



    @Override
    public boolean isPersisteVariableInstanceEnabled() {
        return true;
    }



    @Override
    public Set<String> getBlockList() {


        return blockSet;
    }

    @Override
    public String serialize(Object value) {
        return JSON.toJSONString(value);
    }

    @Override
    public <T> T deserialize(String text, Class<T> clazz) {
        return  JSON.parseObject(text,clazz);
    }
}


```


#### 会签

该模式支持并发会签和顺序会签。 开启会签特性后，SmartEngine 会给每个任务处理者都会创建一个任务实例。 并发会签意味着任务处理者可以并发处理任务，而顺序会签则会按照某种顺序进行，把任务依次分发给对应的任务处理者。 典型的会签代码请参考`MultiInstanceCompatibleAllModelPassedTest`。在开启并发会签特性时，需要注意如下事项：nrOfCompletedInstances 表示完成的任务实例；nrOfRejectedInstance表示拒绝的实例。` action="abort"` 表示满足该条件时，将该流程实例中止掉。

```

 <bpmn2:userTask >
            <bpmn2:multiInstanceLoopCharacteristics>
                <bpmn2:completionCondition xsi:type="bpmn2:tFormalExpression"><![CDATA[${nrOfCompletedInstances  >= 2]]></bpmn2:completionCondition>
                <bpmn2:completionCondition xsi:type="bpmn2:tFormalExpression" action="abort"><![CDATA[${nrOfRejectedInstance  >= 1 ]]></bpmn2:completionCondition>
            </bpmn2:multiInstanceLoopCharacteristics>
        </bpmn2:userTask>

```


在开启顺序会签时，需要进行设置`isSequential="true"` 以及`TaskAssigneeCandidateInstance#priority `。引擎执行时，会优先执行任务优更高的任务。 priority 数值越大，则该任务将会被优先执行。代码片段如下：

```

1. 流程定义：<multiInstanceLoopCharacteristics  isSequential="true">
2. TaskAssigneeDispatcher：在构建TaskAssigneeCandidateInstance 时，设置不同的priority。
public interface TaskAssigneeDispatcher {

    List<TaskAssigneeCandidateInstance> getTaskAssigneeCandidateInstance(Activity activity,Map<String,Object> request);

}

```

## FAQ
### 推荐哪个流程设计器？

经过长时间的实践，我们最终选择Camunda这个开源版本设计器。相关bpmn流程图可以直接用Camunda Modeler 绘制，导出，然后在SmartEngine中无缝使用，不用额外手工修改。   PS:主要特别兼容了 smart:class,smart:properties,smart:eventListener 这几个attributes。 

![图1](https://user-images.githubusercontent.com/216647/162711037-46ea4090-d05d-4b2f-a167-9d1080e338d5.png)
![图2，选中ServiceTask节点](https://user-images.githubusercontent.com/216647/162711064-ee8d9244-aeba-4c40-8c82-79cc7b04fffd.png)


### 目前是否有前端界面应用配合
目前尚未提供。

### 如何扩展SmartEngine的内部功能 
SmartEngine 内部提供了诸多扩展机制，典型的如`ProcessEngineConfiguration` 这个接口，这个比较适合比较简单的业务场景扩展，里面允许用户选择不同的业务实现；复杂的场景，则需要借助`ExtensionBinding`这个注解。 带有`ExtensionBinding`的类，都可以被扩展，它们在运行时可以业务替换成想要的行为。 比如 `@ExtensionBinding(group = ExtensionConstant.ACTIVITY_BEHAVIOR, bindKey = ParallelGateway.class,priority=1) ` ，group,bindKey 用来绑定具体的策略行为，priority 越大，被执行的优先级则越高，也就是说，SE会选择 priority 为最大值的实现类来替换原来的逻辑。同时，也需要将新类报名放在这个子包里面：com.alibaba.smart.framework.engine 里面，便于包扫描.
