const DEFAULT_SCAFFOLDING_ITEMS = [
  'dirt',
  'cobblestone',
  'stone',
  'netherrack',
  'oak_planks',
  'spruce_planks',
  'birch_planks',
  'jungle_planks',
  'acacia_planks',
  'dark_oak_planks',
  'mangrove_planks',
  'cherry_planks',
  'bamboo_planks',
  'planks',
  'cobbled_deepslate'
]

function addScaffoldingBlock(bot, movements, itemName) {
  const item = bot.registry && bot.registry.itemsByName
    ? bot.registry.itemsByName[itemName]
    : null

  if (!item) return
  if (!movements.scafoldingBlocks.includes(item.id)) {
    movements.scafoldingBlocks.push(item.id)
  }
}

function createNavigationMovements({
  bot,
  Movements,
  config = {}
}) {
  const movements = new Movements(bot)

  movements.canDig = config.canDig !== false
  movements.allow1by1towers = config.allow1by1towers !== false
  movements.allowParkour = Boolean(config.allowParkour)

  const scaffoldingItems = Array.isArray(config.scaffoldingItems) && config.scaffoldingItems.length > 0
    ? config.scaffoldingItems
    : DEFAULT_SCAFFOLDING_ITEMS

  for (const itemName of scaffoldingItems) {
    addScaffoldingBlock(bot, movements, itemName)
  }

  return movements
}

module.exports = {
  createNavigationMovements
}
