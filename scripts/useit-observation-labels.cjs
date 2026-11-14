'use strict';

// Explain the recorded operation, not private model reasoning or an assumed outcome.
// Specific faces/files belong in caller-supplied notes; order alone does not identify them.
const LABELS = {
 'agent.run': ['一次 Agent 执行总计', '从这轮 Agent 开始到结束的总时间，包含下面的模型调用和工具操作；不能再与子步骤相加。', 'aggregate'],
 'agent.round': ['一轮连续操作小计', '这一轮中的模型调用和工具操作合在一起的时间；它包住下面的子步骤，不是额外消耗。', 'aggregate'],
 'llm.plan': ['模型请求与等待', '模型处理当前任务和已有结果，生成下一步操作或回复；耗时包含等待模型响应。', 'planning'],
 'stage.product_image_request': ['等待生图服务返回画稿', '向图片服务请求制品画稿并等待返回。这是上层生图工具内部的一段时间，不能重复相加。', 'generation'],
 'stage.product_image_job': ['生成并保存一面画稿', '整套画稿任务中的一个面片：请求图片服务、校验并保存素材。不同面片可能并行，这段时间已计入整套生图。', 'generation'],
 'stage.prompt_rewrite': ['后台整理并改写用户需求', '用轻量模型将原始需求改写为结构化画面说明，再交给 Agent。原文保留并优先；此实验步骤的耗时和费用单列。', 'planning'],
 'llm.gemini-3.1-flash-lite-preview': ['轻量模型生成改写建议', '提示词改写内部的一次轻量模型请求；返回建议仍需校验。耗时已经包含在上层改写步骤中，不能再次相加。', 'planning'],
 'tool.list_packs': ['查看可用工具', '查询当前可以使用哪些工具包，为后续制作选择工具。', 'setup'],
 'tool.load_pack': ['启用制作工具', '加载选中的工具包，让 Agent 可以调用其中的制作功能。', 'setup'],
 'tool.read': ['读取规格或说明资料', '读取任务需要的产品规格、使用说明或文件内容，为后续操作提供依据。', 'setup'],
 'tool.ls': ['查看文件列表', '查看可用目录和文件，寻找下一步需要读取的资料。', 'setup'],
 'tool.plan_write': ['更新任务清单', '记录接下来要做的步骤，或更新步骤的完成状态。', 'setup'],
 'tool.project_plan_write': ['保存产品制作计划', '创建或更新项目中的产品、规格和交付物安排。', 'setup'],
 'tool.tool_image_gen': ['生成或编辑图片', '调用图片服务制作图片，或根据已有图片生成修改版本；完成状态以本次回执为准。', 'generation'],
 'tool.tool_product_image_gen': ['生成或编辑制品画稿', '按照制品的尺寸和目标面片请求画稿；包含等待图片服务返回的时间。', 'generation'],
 'tool.canvas_product_add': ['把素材装入产品画稿', '准备图片素材，将它放到指定面片，并尝试保存产品画稿与版本。超时不代表前端一定停止了。', 'placement'],
 'tool.canvas_product_add_batch': ['批量装配多个面片', '并行准备多张素材，再依次写入同一个产品画稿，避免不同面片的保存相互覆盖。', 'placement'],
 'tool.canvas_product_add_status': ['查询原装配任务的进度', '继续跟踪已有任务，读取当前阶段或原任务的最终保存结果，不重新装配。', 'verification'],
 'tool.canvas_product_inspect': ['检查产品是否保存完整', '读取产品画稿与装配记录，核对图片、图层和面片是否已保存；这一步不做三维渲染。', 'verification'],
 'tool.canvas_product_parts': ['配置产品部件', '创建或调整制品的部件及其安排，例如插片、底座或可替换部件。', 'editing'],
 'tool.dieline_cut': ['制作切割线', '根据产品画稿生成或调整切割轮廓，并检查能否写回画稿。', 'editing'],
 'tool.canvas_white_ink': ['设置白墨印刷层', '根据指定画面和范围生成或调整白墨层，用于制品印刷。', 'editing'],
 'tool.canvas_assembly_create': ['建立组装结构', '创建多个部件之间的组装关系，准备后续布局与预览。', 'editing'],
 'tool.canvas_assembly_read': ['读取当前组装结构', '查看部件和连接关系，为后续组装修改或核验提供依据。', 'verification'],
 'tool.canvas_assembly_update': ['调整部件组装关系', '更新部件的位置、连接或其他组装参数。是否写入成功以回执为准。', 'editing'],
 'tool.canvas_assembly_render': ['生成整体组装预览', '请求整体组装结构的预览图片，用来查看各部件放在一起的效果。', 'render'],
 'tool.canvas_render': ['生成二维画稿预览', '把当前画稿输出成预览图片，方便查看画面内容。', 'render'],
 'tool.canvas3d_read': ['读取三维预览状态', '查询产品的三维状态和可用预览方式，为后续渲染选择入口。', 'verification'],
 'tool.canvas3d_render': ['请求三维预览图片', '尝试从指定视角渲染产品。入口不支持或文件参数有误时，也会在这一步返回错误。', 'render'],
 'tool.respond_to_user': ['汇报本次制作结果', '整理本次操作结果并返回给用户；这一步本身不会重新生成图片或装配产品。', 'response'],
};

function lookupNote(observation, notes) {
 for (const key of [observation?.id, observation?.tool_call_id]) {
  if (key && notes && Object.prototype.hasOwnProperty.call(notes, key)) return notes[key];
 }
 return null;
}

function basicLabel(observation, notes) {
 const name = String(observation?.name || '');
 const fallback = name.startsWith('tool.')
  ? ['未识别的工具操作', '已有这次工具调用的时间记录，但尚无可靠的中文操作说明；原始名称和定位信息保留在详情中。', 'unknown']
  : ['一条执行记录', '这条记录的具体用途尚未归类，不能仅凭名称推断它做了什么。', 'unknown'];
 const [title, description, kind] = LABELS[name] || fallback;
 const note = lookupNote(observation, notes);
 return {
  title: typeof note?.title === 'string' && note.title.trim() ? note.title : title,
  description: typeof note?.description === 'string' && note.description.trim() ? note.description : description,
  kind,
 };
}

function nextRecordedTools(observation, observations) {
 // One model response may submit several sibling tools. Stop at the next model
 // request; do not bridge rounds/traces or include nested tool/service spans.
 if (!observation?.parentObservationId) return [];
 const after = Date.parse(observation.endTime || observation.startTime || '');
 if (!Number.isFinite(after)) return [];
 const following = observations
  .filter(candidate => candidate.id !== observation.id
   && candidate.parentObservationId === observation.parentObservationId
   && (!observation.traceId || candidate.traceId === observation.traceId)
   && (candidate.name === 'llm.plan' || String(candidate.name || '').startsWith('tool.'))
   && Number.isFinite(Date.parse(candidate.startTime || ''))
   && Date.parse(candidate.startTime) >= after)
  .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
 const nextModel = following.find(candidate => candidate.name === 'llm.plan');
 const before = nextModel ? Date.parse(nextModel.startTime) : Infinity;
 return following.filter(candidate => String(candidate.name).startsWith('tool.')
  && Date.parse(candidate.startTime) < before);
}

function describeObservation(observation, observations = [], notes = {}) {
 const result = basicLabel(observation, notes);
 if (observation?.name !== 'llm.plan' || lookupNote(observation, notes)) return result;
 const next = nextRecordedTools(observation, observations);
 if (!next.length) return result;
 const actions = next.map(tool => basicLabel(tool, notes));
 if (actions.every(action => action.kind === 'unknown')) return result;
 if (actions.length > 1) {
  const counts = new Map();
  for (const action of actions) counts.set(action.title, (counts.get(action.title) || 0) + 1);
  const actionTitles = [...counts].map(([title, count]) => title + (count > 1 ? `（${count} 次）` : ''));
  return {
   title: `同轮安排：${actionTitles.join('、')}`,
   description: `这次模型请求后，同一轮提交了 ${next.length} 项工具操作：${actionTitles.join('；')}。依据实际调用说明用途，不代表这些操作都并行执行。这里记录模型处理与响应等待时间，工具执行时间在后面分别列出。`,
   kind: 'planning',
  };
 }
 const action = actions[0];
 return {
  title: `安排下一步：${action.title}`,
  description: `模型调用后，紧接着执行了“${action.title}”。这里记录的是模型处理与响应等待时间；后续工具执行的时间单独列出。`,
  kind: 'planning',
 };
}

module.exports = { describeObservation };
