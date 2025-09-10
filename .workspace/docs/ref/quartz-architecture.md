# Quartz Technical Architecture Documentation

## Overview

Quartz is a modern static site generator built on Node.js that transforms Markdown content into fully functional websites. This document serves as the definitive technical reference for the Quartz architecture.

## Core Architecture

### Build Pipeline Architecture

The build pipeline is initiated when `npx quartz build` is executed:

1. **Bootstrap Phase** (`bootstrap-cli.mjs`):

   ```typescript
   // Entry point configuration
   {
     bin: {
       quartz: "./quartz/bootstrap-cli.mjs"
     }
   }
   ```

   - Uses Node shebang for execution
   - Parses CLI arguments via yargs
   - Configures esbuild for transpilation:
     ```typescript
     const buildConfig = {
       entryPoints: ["quartz/build.ts"],
       bundle: true,
       platform: "node",
       format: "esm",
       plugins: [sassPlugin()],
       outfile: ".quartz-cache/transpiled-build.mjs",
     }
     ```

2. **Development Server** (when `--serve` is enabled):

   - WebSocket server on port 3001 for hot-reload
   - HTTP server on configurable port (default 8080)
   - File watchers for:
     - Source code (`.ts`, `.tsx`, `.scss`)
     - Content (`.md`)
   - Cache busting via query string parameters

3. **Content Processing Pipeline**:

   ```typescript
   // Build process flow
   async function build(argv: BuildArgs) {
     // 1. Clean output
     await rimraf(argv.output)

     // 2. Process content
     const files = await glob("**/*.md", {
       cwd: argv.directory,
       ignore: configuration.ignorePatterns,
     })

     // 3. Parse in parallel if needed
     const processor = new UnifiedProcessor(plugins)
     const contentMap = await (files.length > 128
       ? processInWorkers(files, processor)
       : processSequentially(files, processor))

     // 4. Apply filters
     const filteredContent = applyFilters(contentMap, filters)

     // 5. Emit files
     await Promise.all(emitters.map((e) => e.emit(filteredContent)))
   }
   ```

### File Processing Architecture

1. **Content Parsing**:

   ```typescript
   interface ProcessedContent {
     slug: string
     frontmatter: FrontmatterData
     tree: Node // mdast/hast node
     text: string
     html: string
     links: Link[]
     tags: string[]
   }
   ```

2. **Path Management**:

   ```typescript
   // Nominal typing for path safety
   type FullSlug = string & { __brand: "full" }
   type SimpleSlug = string & { __brand: "simple" }
   type FilePath = string & { __brand: "filepath" }

   // Path transformation functions
   function slugifyFilePath(fp: string): FullSlug
   function simplifySlug(slug: FullSlug): SimpleSlug
   function resolveRelative(current: FullSlug, target: SimpleSlug): string
   ```

## Plugin System

### Plugin Types and Interfaces

1. **Transformer Plugins**:
   Transform content and metadata through multiple stages:

   ```typescript
   interface QuartzTransformerPlugin<Options = undefined> {
     name: string
     textTransform?: (ctx: BuildCtx, src: string) => string
     markdownPlugins?: (ctx: BuildCtx) => PluggableList
     htmlPlugins?: (ctx: BuildCtx) => PluggableList
     externalResources?: (ctx: BuildCtx) => Partial<StaticResources>
   }

   // Common transformer implementations
   const FrontMatter: QuartzTransformerPlugin = () => ({
     name: "FrontMatter",
     markdownPlugins() {
       return [[remarkFrontmatter], [remarkParseFrontmatter]]
     },
   })

   const ObsidianFlavoredMarkdown: QuartzTransformerPlugin = (opts?: {
     comments?: boolean
     highlight?: boolean
     wikilinks?: boolean
     callouts?: boolean
     mermaid?: boolean
     parseTags?: boolean
     enableInHtmlEmbed?: boolean
   }) => ({
     name: "ObsidianFlavoredMarkdown",
     markdownPlugins() {
       return [
         opts?.comments !== false ? remarkObsidianComments : null,
         opts?.highlight !== false ? remarkHighlight : null,
         opts?.wikilinks !== false ? remarkWikiLinks : null,
         // ... other plugin initializations
       ].filter(Boolean)
     },
   })
   ```

2. **Filter Plugins**:
   Control what content gets published:

   ```typescript
   interface QuartzFilterPlugin<Options = undefined> {
     name: string
     shouldPublish(ctx: BuildCtx, content: ProcessedContent): boolean
   }

   // Example implementations
   const RemoveDrafts: QuartzFilterPlugin = () => ({
     name: "RemoveDrafts",
     shouldPublish(_ctx, [_tree, vfile]) {
       const draftFlag = vfile.data?.frontmatter?.draft ?? false
       return !draftFlag
     },
   })

   const ExplicitPublish: QuartzFilterPlugin = () => ({
     name: "ExplicitPublish",
     shouldPublish(_ctx, [_tree, vfile]) {
       const publishFlag = vfile.data?.frontmatter?.publish ?? false
       return publishFlag
     },
   })
   ```

3. **Emitter Plugins**:
   Generate output files and resources:

   ```typescript
   interface QuartzEmitterPlugin<Options = undefined> {
     name: string
     emit(
       ctx: BuildCtx,
       content: ProcessedContent[],
       resources: StaticResources,
     ): Promise<FilePath[]>
     getQuartzComponents(ctx: BuildCtx): QuartzComponent[]
   }

   // Example implementation
   const ContentPage: QuartzEmitterPlugin = () => {
     const layout: FullPageLayout = {
       head: Head(),
       header: [],
       beforeBody: [PageTitle(), ContentMeta()],
       pageBody: Content(),
       left: [Explorer(), Search(), Darkmode()],
       right: [Graph(), TableOfContents(), Backlinks()],
       footer: Footer(),
     }

     return {
       name: "ContentPage",
       getQuartzComponents() {
         return [...Object.values(layout)].flat()
       },
       async emit(ctx, content, resources) {
         const fps: FilePath[] = []
         const allFiles = content.map((c) => c[1].data)

         for (const [tree, file] of content) {
           const slug = canonicalizeServer(file.data.slug!)
           const externalResources = pageResources(slug, file.data, resources)
           const componentData: QuartzComponentProps = {
             fileData: file.data,
             externalResources,
             cfg: ctx.cfg.configuration,
             children: [],
             tree,
             allFiles,
           }

           const content = renderPage(ctx.cfg, slug, componentData, layout, externalResources)
           const fp = await write({
             ctx,
             content,
             slug: file.data.slug!,
             ext: ".html",
           })

           fps.push(fp)
         }
         return fps
       },
     }
   }
   ```

### Core Components Implementation

1. **Search Component**:

   ```typescript
   interface SearchOptions {
     enablePreview?: boolean
     enableBacklinks?: boolean
     searchKeyboardShortcut?: boolean
   }

   const Search: QuartzComponent = (opts?: SearchOptions) => {
     const options = { ...defaultOptions, ...opts }

     function Search(props: QuartzComponentProps) {
       return <div class="search">
         <div id="search-icon">
           <p>Search</p>
           <div></div>
           <svg>...</svg>
         </div>
         {options.enablePreview && <div id="search-container">
           <div id="search-space">
             <input autocomplete="off" id="search-bar" name="search" type="text" />
             <div id="results-container"></div>
           </div>
         </div>}
       </div>
     }

     Search.afterDOMLoaded = `
       const search = new FlexSearch.Document({
         tokenize: "full",
         document: {
           id: "id",
           index: ["title", "content"],
           store: ["title", "content"]
         },
         context: {
           resolution: 9,
           depth: 2,
           bidirectional: true
         }
       })

       const resultToHTML = (result) => {
         const content = highlight(result.content)
         return \`<div class="result">
           <h3>\${result.title}</h3>
           <p>\${content}</p>
         </div>\`
       }
     `

     Search.css = `
       .search {
         position: relative;
         width: 100%;
         display: flex;
         align-items: center;
       }
       // ... more styles
     `

     return Search
   }
   ```

2. **Graph Component**:

   ```typescript
   interface GraphOptions {
     localGraph?: {
       drag?: boolean
       zoom?: boolean
       depth?: number
       scale?: number
       repelForce?: number
       centerForce?: number
       linkDistance?: number
       fontSize?: number
       opacityScale?: number
       removeTags?: string[]
       showTags?: boolean
     }
     globalGraph?: {
       drag?: boolean
       zoom?: boolean
       depth?: number
       scale?: number
       repelForce?: number
       centerForce?: number
       linkDistance?: number
       fontSize?: number
       opacityScale?: number
       removeTags?: string[]
       showTags?: boolean
     }
   }

   const Graph: QuartzComponent = (opts?: GraphOptions) => {
     const options = { ...defaultOptions, ...opts }

     function Graph(props: QuartzComponentProps) {
       return <div class="graph">
         <div class="graph-outer">
           <div id="graph-container" data-cfg={JSON.stringify(options)}>
             <svg width="100%" height="100%">
               <g class="graph-container"></g>
             </svg>
           </div>
           {options.globalGraph && <div class="graph-toggle">
             <button class="graph-toggle-button">
               <svg>...</svg>
             </button>
           </div>}
         </div>
       </div>
     }

     Graph.afterDOMLoaded = `
       const container = document.getElementById("graph-container")
       const cfg = JSON.parse(container.dataset.cfg)

       const graph = new D3Graph(container, cfg)
       graph.render()

       window.addCleanup(() => graph.destroy())
     `

     Graph.css = `
       .graph {
         width: 100%;
         aspect-ratio: 1 / 1;
       }
       // ... more styles
     `

     return Graph
   }
   ```

3. **Explorer Component**:

   ```typescript
   interface ExplorerOptions {
     title?: string
     folderClickBehavior?: "collapse" | "link"
     folderDefaultState?: "collapsed" | "open"
     useSavedState?: boolean
     sortFn?: (a: FileNode, b: FileNode) => number
     filterFn?: (node: FileNode) => boolean
     mapFn?: (node: FileNode) => void
     order?: ("filter" | "map" | "sort")[]
   }

   const Explorer: QuartzComponent = (opts?: ExplorerOptions) => {
     const options = {
       title: "Explorer",
       folderClickBehavior: "collapse",
       folderDefaultState: "collapsed",
       useSavedState: true,
       ...opts
     }

     function Explorer(props: QuartzComponentProps) {
       return <div class="explorer">
         <h1>{options.title}</h1>
         <div class="folder-tree">
           <ExplorerNode node={buildFileTree(props.allFiles)} options={options} />
         </div>
       </div>
     }

     Explorer.css = `
       .explorer {
         position: relative;
         overflow-y: auto;
         flex: 1;
         min-height: 0;
       }
       // ... more styles
     `

     Explorer.afterDOMLoaded = `
       const explorer = document.querySelector('.explorer')
       const savedState = options.useSavedState
         ? JSON.parse(localStorage.getItem('fileTree') ?? '{}')
         : {}

       // Initialize folder states
       explorer.querySelectorAll('.folder').forEach(folder => {
         const path = folder.dataset.path
         const state = savedState[path] ?? options.folderDefaultState
         folder.classList.toggle('open', state === 'open')
       })

       // Handle clicks
       explorer.addEventListener('click', (e) => {
         const target = e.target.closest('.folder')
         if (!target) return

         if (options.folderClickBehavior === 'collapse') {
           target.classList.toggle('open')
           if (options.useSavedState) {
             savedState[target.dataset.path] = target.classList.contains('open') ? 'open' : 'collapsed'
             localStorage.setItem('fileTree', JSON.stringify(savedState))
           }
         }
       })
     `

     return Explorer
   }
   ```

4. **Backlinks Component**:

   ```typescript
   interface BacklinksOptions {
     hideIfEmpty?: boolean
   }

   const Backlinks: QuartzComponent = (opts?: BacklinksOptions) => {
     const options = {
       hideIfEmpty: true,
       ...opts
     }

     function Backlinks(props: QuartzComponentProps) {
       const backlinks = props.fileData.backlinks ?? []
       if (options.hideIfEmpty && backlinks.length === 0) {
         return null
       }

       return <div class="backlinks">
         <h3>Backlinks</h3>
         <ul>
           {backlinks.map(link => (
             <li>
               <a href={link.slug}>{link.title}</a>
               {link.excerpt && <p class="excerpt">{link.excerpt}</p>}
             </li>
           ))}
         </ul>
       </div>
     }

     Backlinks.css = `
       .backlinks {
         margin-top: 2rem;
         padding: 1rem;
         border-radius: 5px;
       }
       // ... more styles
     `

     return Backlinks
   }
   ```

5. **TableOfContents Component**:

   ```typescript
   interface TOCOptions {
     layout?: "modern" | "legacy"
     minEntries?: number
     maxDepth?: number
     collapseByDefault?: boolean
   }

   const TableOfContents: QuartzComponent = (opts?: TOCOptions) => {
     const options = {
       layout: "modern",
       minEntries: 1,
       maxDepth: 3,
       collapseByDefault: false,
       ...opts
     }

     function TableOfContents(props: QuartzComponentProps) {
       const headers = extractHeaders(props.tree, options.maxDepth)
       if (headers.length <= options.minEntries) return null

       return <div class={`toc ${options.layout}`}>
         <h3>Table of Contents</h3>
         <div class="toc-content">
           {renderTOC(headers)}
         </div>
       </div>
     }

     TableOfContents.css = `
       .toc {
         padding: 1rem;
         border-radius: 5px;
       }
       // ... more styles
     `

     TableOfContents.afterDOMLoaded = `
       const toc = document.querySelector('.toc')
       if (!toc) return

       // Highlight current section
       const observer = new IntersectionObserver(entries => {
         entries.forEach(entry => {
           const id = entry.target.getAttribute('id')
           const tocItem = toc.querySelector(\`a[href="#\${id}"]\`)
           if (tocItem) {
             if (entry.isIntersecting) {
               tocItem.classList.add('active')
             } else {
               tocItem.classList.remove('active')
             }
           }
         })
       })

       document.querySelectorAll('h1[id], h2[id], h3[id]')
         .forEach(section => observer.observe(section))
     `

     return TableOfContents
   }
   ```

6. **Darkmode Component**:

   ```typescript
   const Darkmode: QuartzComponent = () => {
     function Darkmode() {
       return <div class="darkmode">
         <input type="checkbox" id="darkmode-toggle" />
         <label for="darkmode-toggle">
           <svg class="sun" {...sunIconProps}>...</svg>
           <svg class="moon" {...moonIconProps}>...</svg>
         </label>
       </div>
     }

     Darkmode.css = `
       .darkmode {
         position: relative;
         width: 24px;
         height: 24px;
       }
       // ... more styles
     `

     Darkmode.afterDOMLoaded = `
       const darkmode = document.querySelector('.darkmode')
       const toggle = darkmode.querySelector('input')

       // Initialize theme
       if (localStorage.getItem('theme') === 'dark' ||
           (!localStorage.getItem('theme') &&
            window.matchMedia('(prefers-color-scheme: dark)').matches)) {
         document.documentElement.classList.add('dark')
         toggle.checked = true
       }

       // Handle changes
       toggle.addEventListener('change', () => {
         document.documentElement.classList.toggle('dark')
         localStorage.setItem('theme',
           document.documentElement.classList.contains('dark') ? 'dark' : 'light')

         // Dispatch event for other components
         window.dispatchEvent(new CustomEvent('themechange', {
           detail: {
             theme: document.documentElement.classList.contains('dark')
               ? 'dark'
               : 'light'
           }
         }))
       })
     `

     return Darkmode
   }
   ```

### Advanced Plugin Features

1. **Plugin Composition**:

   ```typescript
   // Plugin composition helper
   function composePlugins<T extends QuartzPlugin>(...plugins: T[]): T {
     return plugins.reduce((acc, plugin) => ({
       ...acc,
       ...plugin,
       name: `${acc.name}+${plugin.name}`,
       async transform(ctx, content) {
         content = (await acc.transform?.(ctx, content)) ?? content
         return (await plugin.transform?.(ctx, content)) ?? content
       },
     }))
   }
   ```

2. **Plugin Configuration Management**:

   ```typescript
   interface PluginManager {
     transformers: Map<string, QuartzTransformerPlugin>
     filters: Map<string, QuartzFilterPlugin>
     emitters: Map<string, QuartzEmitterPlugin>

     register<T extends QuartzPlugin>(plugin: T): void
     execute(ctx: BuildCtx, content: ProcessedContent): Promise<void>
   }

   class DefaultPluginManager implements PluginManager {
     private transformers = new Map()
     private filters = new Map()
     private emitters = new Map()

     register(plugin: QuartzPlugin) {
       const map = this.getMapForPlugin(plugin)
       map.set(plugin.name, plugin)
     }

     async execute(ctx: BuildCtx, content: ProcessedContent) {
       // Transform phase
       for (const transformer of this.transformers.values()) {
         content = await transformer.transform(ctx, content)
       }

       // Filter phase
       const shouldPublish = Array.from(this.filters.values()).every((filter) =>
         filter.shouldPublish(ctx, content),
       )

       if (!shouldPublish) return

       // Emit phase
       await Promise.all(
         Array.from(this.emitters.values()).map((emitter) => emitter.emit(ctx, [content])),
       )
     }
   }
   ```

## Component System

### Component Architecture

1. **Base Component Interface**:

   ```typescript
   interface QuartzComponent {
     (props: QuartzComponentProps): JSX.Element
     css?: string
     beforeDOMLoaded?: string
     afterDOMLoaded?: string
   }
   ```

2. **Component Props**:

   ```typescript
   interface QuartzComponentProps {
     fileData: QuartzPluginData
     cfg: GlobalConfiguration
     tree: Node<QuartzPluginData>
     allFiles: QuartzPluginData[]
     displayClass?: "mobile-only" | "desktop-only"
   }
   ```

3. **Layout System**:
   ```typescript
   interface FullPageLayout {
     head: QuartzComponent
     header: QuartzComponent[]
     beforeBody: QuartzComponent[]
     pageBody: QuartzComponent
     afterBody: QuartzComponent[]
     left: QuartzComponent[]
     right: QuartzComponent[]
     footer: QuartzComponent
   }
   ```

### Resource Management

1. **Static Resources**:

   ```typescript
   interface StaticResources {
     css: CSSResource[]
     js: JSResource[]
   }

   interface CSSResource {
     src?: string
     content?: string
   }

   interface JSResource {
     src?: string
     content?: string
     loadTime: "beforeDOMReady" | "afterDOMReady"
     contentType: "inline" | "external"
   }
   ```

## Client-Side Architecture

### Navigation System

```typescript
interface NavigationState {
  url: string
  title: string
  scrollPosition: { x: number; y: number }
  data: Record<string, unknown>
}

class NavigationManager {
  private history: NavigationState[] = []
  private currentIndex = -1
  private prefetchCache = new Map<string, string>()

  constructor() {
    // Initialize history state
    window.addEventListener('popstate', this.handlePopState.bind(this))
    window.addEventListener('scroll', debounce(this.saveScrollPosition.bind(this), 100))

    // Setup prefetching
    if ('IntersectionObserver' in window) {
      this.setupPrefetching()
    }
  }

  private setupPrefetching() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLAnchorElement
          this.prefetch(link.href)
        }
      })
    })

    // Observe all internal links
    document.querySelectorAll('a[href^="/"]').forEach((link) => {
      observer.observe(link)
    })
  }

  private async prefetch(url: string) {
    if (this.prefetchCache.has(url)) return

    try {
      const response = await fetch(url)
      const html = await response.text()
      this.prefetchCache.set(url, html)
    } catch (error) {
      console.warn(\`Failed to prefetch \${url}\`, error)
    }
  }

  async navigate(url: string, { replace = false } = {}) {
    // 1. Save current state
    this.saveCurrentState()

    // 2. Load new page
    const content = this.prefetchCache.get(url) ?? await fetchPage(url)

    // 3. Update DOM using micromorph
    const morphPromise = micromorph(document.documentElement, content)

    // 4. Update history
    const state: NavigationState = {
      url,
      title: document.title,
      scrollPosition: { x: 0, y: 0 },
      data: {}
    }

    if (replace) {
      history.replaceState(state, '', url)
    } else {
      history.pushState(state, '', url)
      this.currentIndex++
      this.history[this.currentIndex] = state
    }

    // 5. Wait for DOM updates
    await morphPromise

    // 6. Update meta tags for SEO
    this.updateMetaTags()

    // 7. Trigger page-specific initialization
    this.initializeNewPage()
  }

  private updateMetaTags() {
    // Update meta tags based on new page content
    const metaDescription = document.querySelector('meta[name="description"]')
    const ogTitle = document.querySelector('meta[property="og:title"]')
    const ogDescription = document.querySelector('meta[property="og:description"]')

    // Update meta tags based on page content
    if (metaDescription) {
      metaDescription.setAttribute('content', extractPageDescription())
    }
    if (ogTitle) {
      ogTitle.setAttribute('content', document.title)
    }
    if (ogDescription) {
      ogDescription.setAttribute('content', extractPageDescription())
    }
  }

  private initializeNewPage() {
    // Re-run component initialization
    window.dispatchEvent(new CustomEvent('quartz:beforeDOMLoad'))

    // Initialize syntax highlighting
    if (window.Prism) {
      window.Prism.highlightAll()
    }

    // Initialize MathJax if present
    if (window.MathJax) {
      window.MathJax.typeset()
    }

    window.dispatchEvent(new CustomEvent('quartz:afterDOMLoad'))
  }
}

// Initialize navigation manager
const navigation = new NavigationManager()

// Handle all internal navigation
document.addEventListener('click', (e) => {
  const link = e.target.closest('a')
  if (link && link.href.startsWith(window.location.origin)) {
    e.preventDefault()
    navigation.navigate(link.href)
  }
})
```

### Build Pipeline Internals

```typescript
interface BuildContext {
  startTime: number
  cache: BuildCache
  graph: DependencyGraph
  workers: WorkerPool
  stats: BuildStats
}

class BuildPipeline {
  private ctx: BuildContext
  private transformers: TransformerPlugin[]
  private optimizers: OptimizerPlugin[]

  constructor() {
    this.ctx = {
      startTime: Date.now(),
      cache: new BuildCache(),
      graph: new DependencyGraph(),
      workers: new WorkerPool(),
      stats: new BuildStats(),
    }
  }

  async execute() {
    // 1. Initialize build context
    await this.initialize()

    // 2. Content Processing
    const files = await this.gatherFiles()
    const chunks = this.chunking.splitIntoChunks(files)

    // 3. Parallel Processing
    await Promise.all(chunks.map((chunk) => this.workers.schedule(() => this.processChunk(chunk))))

    // 4. Asset Optimization
    await this.optimizeAssets()

    // 5. Generate Source Maps
    await this.generateSourceMaps()

    // 6. Finalize Build
    await this.finalize()
  }

  private async processChunk(chunk: BuildChunk) {
    const processed = new Map<string, ProcessedContent>()

    for (const file of chunk.files) {
      // Check cache first
      const hash = await this.hashFile(file)
      const cached = this.ctx.cache.get(file, hash)

      if (cached) {
        processed.set(file, cached)
        continue
      }

      // Process file through transformer pipeline
      let content = await fs.readFile(file, "utf8")

      for (const transformer of this.transformers) {
        try {
          content = await transformer.transform(content, {
            file,
            cache: this.ctx.cache,
            graph: this.ctx.graph,
          })
        } catch (error) {
          throw new TransformerError(transformer.name, file, error)
        }
      }

      // Update cache
      this.ctx.cache.set(file, hash, content)
      processed.set(file, content)
    }

    return processed
  }

  private async optimizeAssets() {
    const optimizationContext = {
      isDevelopment: process.env.NODE_ENV === "development",
      cache: this.ctx.cache,
      stats: this.ctx.stats,
    }

    for (const optimizer of this.optimizers) {
      await optimizer.optimize(optimizationContext)
    }
  }

  private async generateSourceMaps() {
    if (process.env.NODE_ENV === "production") {
      const sourceMapGenerator = new SourceMapGenerator()

      for (const [file, content] of this.ctx.cache.entries()) {
        if (content.sourceMap) {
          await sourceMapGenerator.addMap(file, content.sourceMap)
        }
      }

      await sourceMapGenerator.write(this.ctx.outputDir)
    }
  }
}

class BuildCache {
  private cache: Map<string, CacheEntry> = new Map()
  private persistentPath: string

  constructor() {
    this.persistentPath = path.join(process.cwd(), ".quartz-cache")
    this.loadPersistentCache()
  }

  get(file: string, hash: string): ProcessedContent | undefined {
    const entry = this.cache.get(file)
    if (entry?.hash === hash) {
      return entry.content
    }
  }

  set(file: string, hash: string, content: ProcessedContent) {
    this.cache.set(file, { hash, content })
    this.persistCache()
  }

  private async loadPersistentCache() {
    try {
      const data = await fs.readFile(this.persistentPath, "utf8")
      this.cache = new Map(JSON.parse(data))
    } catch {
      // Cache file doesn't exist or is invalid
    }
  }

  private async persistCache() {
    const data = JSON.stringify(Array.from(this.cache.entries()))
    await fs.writeFile(this.persistentPath, data)
  }
}
```

### Component Lifecycle Management

```typescript
interface ComponentLifecycle {
  beforeMount?: () => void | Promise<void>
  afterMount?: () => void | Promise<void>
  beforeUpdate?: () => void | Promise<void>
  afterUpdate?: () => void | Promise<void>
  beforeUnmount?: () => void | Promise<void>
  afterUnmount?: () => void | Promise<void>
}

class ComponentManager {
  private components: Map<string, QuartzComponent> = new Map()
  private lifecycles: Map<string, ComponentLifecycle> = new Map()
  private state: Map<string, unknown> = new Map()
  private subscriptions: Map<string, Set<() => void>> = new Map()

  register(name: string, component: QuartzComponent, lifecycle?: ComponentLifecycle) {
    this.components.set(name, component)
    if (lifecycle) {
      this.lifecycles.set(name, lifecycle)
    }
  }

  async mount(name: string, props: QuartzComponentProps) {
    const component = this.components.get(name)
    const lifecycle = this.lifecycles.get(name)

    if (!component) {
      throw new ComponentError(\`Component \${name} not found\`)
    }

    try {
      // 1. Before mount
      await lifecycle?.beforeMount?.()

      // 2. Render component
      const element = component(props)

      // 3. Initialize state
      if (component.initialState) {
        this.state.set(name, component.initialState)
      }

      // 4. Setup subscriptions
      if (component.subscriptions) {
        const subs = new Set<() => void>()
        component.subscriptions.forEach(event => {
          const handler = () => this.handleComponentUpdate(name)
          window.addEventListener(event, handler)
          subs.add(() => window.removeEventListener(event, handler))
        })
        this.subscriptions.set(name, subs)
      }

      // 5. After mount
      await lifecycle?.afterMount?.()

      return element
    } catch (error) {
      throw new ComponentMountError(name, error)
    }
  }

  async unmount(name: string) {
    const lifecycle = this.lifecycles.get(name)

    try {
      // 1. Before unmount
      await lifecycle?.beforeUnmount?.()

      // 2. Cleanup subscriptions
      const subs = this.subscriptions.get(name)
      if (subs) {
        subs.forEach(cleanup => cleanup())
        this.subscriptions.delete(name)
      }

      // 3. Clear state
      this.state.delete(name)

      // 4. After unmount
      await lifecycle?.afterUnmount?.()
    } catch (error) {
      throw new ComponentUnmountError(name, error)
    }
  }

  private async handleComponentUpdate(name: string) {
    const lifecycle = this.lifecycles.get(name)

    try {
      // 1. Before update
      await lifecycle?.beforeUpdate?.()

      // 2. Trigger component update
      const component = this.components.get(name)
      if (component.update) {
        await component.update(this.state.get(name))
      }

      // 3. After update
      await lifecycle?.afterUpdate?.()
    } catch (error) {
      throw new ComponentUpdateError(name, error)
    }
  }

  getState(name: string): unknown {
    return this.state.get(name)
  }

  setState(name: string, updater: (prev: unknown) => unknown) {
    const prev = this.state.get(name)
    const next = updater(prev)
    this.state.set(name, next)
    this.handleComponentUpdate(name)
  }
}

// Initialize component manager
const componentManager = new ComponentManager()

// Register components with lifecycles
componentManager.register('Explorer', Explorer, {
  async afterMount() {
    // Initialize folder state
    const savedState = localStorage.getItem('explorerState')
    if (savedState) {
      this.setState(JSON.parse(savedState))
    }
  },
  async beforeUnmount() {
    // Save folder state
    localStorage.setItem('explorerState', JSON.stringify(this.getState()))
  }
})

// Component update example
window.addEventListener('themechange', () => {
  componentManager.setState('Graph', (prev: GraphState) => ({
    ...prev,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  }))
})
```

## Build and Development Tools

### Development Server

```typescript
interface ServerOptions {
  port: number
  wsPort: number
  directory: string
  baseUrl: string
  servePreview: boolean
}

class QuartzServer {
  private wsServer: WebSocketServer
  private httpServer: http.Server
  private watcher: FSWatcher

  constructor(options: ServerOptions) {
    this.setupWebSocket()
    this.setupHTTPServer()
    this.setupFileWatcher()
  }

  private setupWebSocket() {
    this.wsServer = new WebSocketServer({ port: this.options.wsPort })
    this.wsServer.on("connection", this.handleWSConnection)
  }

  private setupHTTPServer() {
    this.httpServer = http.createServer(this.handleRequest)
    this.httpServer.listen(this.options.port)
  }

  private setupFileWatcher() {
    this.watcher = chokidar.watch(this.options.directory)
    this.watcher.on("change", this.handleFileChange)
  }
}
```

### Build Process Configuration

```typescript
interface BuildConfiguration {
  // Content processing
  contentDirectory: string
  outputDirectory: string
  baseUrl: string

  // Build options
  concurrency: number
  verbose: boolean

  // Plugin configuration
  plugins: {
    transformers: QuartzTransformerPlugin[]
    filters: QuartzFilterPlugin[]
    emitters: QuartzEmitterPlugin[]
  }

  // Resource handling
  assets: {
    css: string[]
    js: string[]
  }
}
```

## Configuration System

### Global Configuration

```typescript
interface QuartzConfig {
  configuration: {
    pageTitle: string
    enableSPA: boolean
    enablePopovers: boolean
    analytics: AnalyticsConfig
    baseUrl: string
    ignorePatterns: string[]
    theme: ThemeConfig
    locale: string
  }
  plugins: {
    transformers: QuartzTransformerPlugin[]
    filters: QuartzFilterPlugin[]
    emitters: QuartzEmitterPlugin[]
  }
}

interface ThemeConfig {
  typography: {
    header: string
    body: string
    code: string
  }
  colors: {
    light: string
    lightgray: string
    dark: string
    darkgray: string
    secondary: string
    tertiary: string
    highlight: string
  }
}
```

## Security Considerations

1. **Content Security**:

   - HTML sanitization for Markdown content
   - Safe resource loading practices
   - XSS prevention in component rendering

2. **Resource Integrity**:
   - Subresource Integrity (SRI) for external resources
   - Secure asset handling
   - CORS configuration

## Performance Optimizations

1. **Build Performance**:

   - Parallel content processing
   - Caching of transpiled assets
   - Incremental builds

2. **Runtime Performance**:
   - Code splitting
   - Resource lazy loading
   - Efficient DOM updates

## Extension Points

1. **Plugin Development**:

   ```typescript
   // Custom plugin template
   function createCustomPlugin<Options>(opts?: Options): QuartzPlugin {
     return {
       name: "CustomPlugin",
       async transform(ctx, content) {
         // Custom transformation logic
         return modifiedContent
       },
     }
   }
   ```

2. **Component Development**:
   ```typescript
   // Custom component template
   const CustomComponent: QuartzComponentConstructor = (opts?: Options) => {
     return {
       name: 'CustomComponent',
       component(props: QuartzComponentProps) {
         return <div>{/* Custom JSX */}</div>
       },
       css: `/* Custom styles */`,
       beforeDOMLoaded: `/* Custom init script */`
     }
   }
   ```

## Testing and Validation

1. **Build Validation**:

   - Content integrity checks
   - Resource availability verification
   - Link validation

2. **Runtime Validation**:
   - Component lifecycle checks
   - Resource loading verification
   - Navigation state validation

## Error Handling

```typescript
// Error types
type QuartzErrorCode =
  | "PLUGIN_EXECUTION_ERROR"
  | "COMPONENT_RENDER_ERROR"
  | "RESOURCE_LOAD_ERROR"
  | "BUILD_ERROR"
  | "PARSE_ERROR"
  | "FRONTMATTER_PARSE_ERROR"
  | "LINK_RESOLUTION_ERROR"
  | "FILE_NOT_FOUND"
  | "INVALID_CONFIG"
  | "PLUGIN_INITIALIZATION_ERROR"
  | "COMPONENT_INITIALIZATION_ERROR"

interface QuartzErrorDetails {
  plugin?: string
  component?: string
  file?: string
  phase?: "transform" | "filter" | "emit"
  line?: number
  column?: number
  sourceCode?: string
  config?: Partial<QuartzConfig>
}

// Specific error classes
class PluginExecutionError extends QuartzError {
  constructor(plugin: string, phase: string, originalError: Error) {
    super(
      `Failed to execute plugin "${plugin}" during ${phase} phase: ${originalError.message}`,
      "PLUGIN_EXECUTION_ERROR",
      { plugin, phase, originalError },
    )
  }
}

class ComponentRenderError extends QuartzError {
  constructor(component: string, originalError: Error) {
    super(
      `Failed to render component "${component}": ${originalError.message}`,
      "COMPONENT_RENDER_ERROR",
      { component, originalError },
    )
  }
}

class FrontmatterParseError extends QuartzError {
  constructor(file: string, line: number, details: string) {
    super(
      `Failed to parse frontmatter in "${file}" at line ${line}: ${details}`,
      "FRONTMATTER_PARSE_ERROR",
      { file, line, details },
    )
  }
}

// Error handling middleware
class ErrorHandler {
  private static handlers: Map<QuartzErrorCode, (error: QuartzError) => void> = new Map()

  static register(code: QuartzErrorCode, handler: (error: QuartzError) => void) {
    this.handlers.set(code, handler)
  }

  static handle(error: QuartzError) {
    console.error(`[${error.code}] ${error.message}`)

    // Log detailed error information
    if (error.details) {
      console.debug("Error context:", {
        ...error.details,
        stack: error.stack,
      })
    }

    // Call specific handler if registered
    const handler = this.handlers.get(error.code)
    if (handler) {
      handler(error)
    }

    // Default error handling behavior
    switch (error.code) {
      case "PLUGIN_EXECUTION_ERROR":
        this.handlePluginError(error)
        break
      case "COMPONENT_RENDER_ERROR":
        this.handleComponentError(error)
        break
      case "FRONTMATTER_PARSE_ERROR":
        this.handleFrontmatterError(error)
        break
      case "LINK_RESOLUTION_ERROR":
        this.handleLinkError(error)
        break
      case "BUILD_ERROR":
        this.handleBuildError(error)
        break
      default:
        this.handleGenericError(error)
    }
  }

  private static handlePluginError(error: QuartzError) {
    const { plugin, phase } = error.details
    console.error(`Plugin "${plugin}" failed during ${phase} phase`)
    console.error("Consider checking:")
    console.error("1. Plugin configuration in quartz.config.ts")
    console.error("2. Plugin input/output validation")
    console.error("3. Plugin dependencies and version compatibility")
  }

  private static handleComponentError(error: QuartzError) {
    const { component } = error.details
    console.error(`Component "${component}" failed to render`)
    console.error("Consider checking:")
    console.error("1. Component props validation")
    console.error("2. Component lifecycle methods")
    console.error("3. Component dependencies and resource loading")
  }

  private static handleFrontmatterError(error: QuartzError) {
    const { file, line } = error.details
    console.error(`Frontmatter parse error in "${file}" at line ${line}`)
    console.error("Consider checking:")
    console.error("1. YAML syntax")
    console.error("2. Required frontmatter fields")
    console.error("3. Data type validation")
  }

  private static handleLinkError(error: QuartzError) {
    const { file } = error.details
    console.error(`Link resolution error in "${file}"`)
    console.error("Consider checking:")
    console.error("1. Link target existence")
    console.error("2. Link syntax")
    console.error("3. File organization and paths")
  }

  private static handleBuildError(error: QuartzError) {
    console.error("Build process failed")
    console.error("Consider checking:")
    console.error("1. Configuration validity")
    console.error("2. File system permissions")
    console.error("3. Available system resources")
  }

  private static handleGenericError(error: QuartzError) {
    console.error("An unexpected error occurred")
    console.error("Consider checking:")
    console.error("1. System requirements")
    console.error("2. Configuration validity")
    console.error("3. Recent changes or updates")
  }
}

// Error recovery strategies
class ErrorRecovery {
  static async attemptRecovery(error: QuartzError): Promise<boolean> {
    switch (error.code) {
      case "PLUGIN_EXECUTION_ERROR":
        return await this.recoverPluginExecution(error)
      case "RESOURCE_LOAD_ERROR":
        return await this.recoverResourceLoad(error)
      case "BUILD_ERROR":
        return await this.recoverBuild(error)
      default:
        return false
    }
  }

  private static async recoverPluginExecution(error: QuartzError): Promise<boolean> {
    const { plugin } = error.details
    console.log(`Attempting to recover from plugin execution error in "${plugin}"`)

    try {
      // Attempt plugin reload
      await reloadPlugin(plugin)
      return true
    } catch {
      return false
    }
  }

  private static async recoverResourceLoad(error: QuartzError): Promise<boolean> {
    const { file } = error.details
    console.log(`Attempting to recover from resource load error for "${file}"`)

    try {
      // Attempt resource reload
      await reloadResource(file)
      return true
    } catch {
      return false
    }
  }

  private static async recoverBuild(error: QuartzError): Promise<boolean> {
    console.log("Attempting to recover from build error")

    try {
      // Attempt cleanup and rebuild
      await cleanup()
      await rebuild()
      return true
    } catch {
      return false
    }
  }
}

// Usage example
try {
  await buildQuartzSite()
} catch (error) {
  if (error instanceof QuartzError) {
    ErrorHandler.handle(error)
    const recovered = await ErrorRecovery.attemptRecovery(error)
    if (!recovered) {
      process.exit(1)
    }
  } else {
    throw error
  }
}
```

## Deployment Architecture

1. **Static Site Generation**:

   - Full content pre-rendering
   - Asset optimization
   - Resource path resolution

2. **Hosting Requirements**:
   - Static file serving
   - Optional SPA support
   - CORS configuration

## Version Control and Updates

1. **Update Process**:

   ```typescript
   async function updateQuartz() {
     // 1. Backup content
     await backupContent()

     // 2. Pull updates
     await git.pull("upstream", "v4")

     // 3. Restore content
     await restoreContent()

     // 4. Rebuild
     await rebuild()
   }
   ```

2. **Version Compatibility**:
   - Plugin API versioning
   - Component interface stability
   - Configuration migration

This technical architecture document serves as the definitive reference for understanding and extending the Quartz system. It provides the necessary context for AI assistants to help with development, debugging, and customization tasks.

## Implementation Best Practices

1. **Plugin Development**:

   - Keep plugins focused and single-purpose
   - Use composition for complex transformations
   - Implement proper cleanup in emitters
   - Cache expensive computations
   - Handle errors gracefully

2. **Component Development**:

   - Separate concerns between markup, styles, and scripts
   - Use TypeScript for better type safety
   - Implement proper cleanup in `afterDOMLoaded`
   - Follow React-like patterns for consistency
   - Keep components pure and predictable

3. **Resource Management**:

   - Lazy load non-critical resources
   - Use appropriate caching strategies
   - Implement proper cleanup
   - Handle asset loading errors
   - Optimize bundle sizes

4. **Error Handling**:

   ```typescript
   // Error types
   type QuartzErrorCode =
     | "PLUGIN_EXECUTION_ERROR"
     | "COMPONENT_RENDER_ERROR"
     | "RESOURCE_LOAD_ERROR"
     | "BUILD_ERROR"
     | "PARSE_ERROR"
     | "FRONTMATTER_PARSE_ERROR"
     | "LINK_RESOLUTION_ERROR"
     | "FILE_NOT_FOUND"
     | "INVALID_CONFIG"
     | "PLUGIN_INITIALIZATION_ERROR"
     | "COMPONENT_INITIALIZATION_ERROR"

   interface QuartzErrorDetails {
     plugin?: string
     component?: string
     file?: string
     phase?: "transform" | "filter" | "emit"
     line?: number
     column?: number
     sourceCode?: string
     config?: Partial<QuartzConfig>
   }

   // Specific error classes
   class PluginExecutionError extends QuartzError {
     constructor(plugin: string, phase: string, originalError: Error) {
       super(
         \`Failed to execute plugin "\${plugin}" during \${phase} phase: \${originalError.message}\`,
         "PLUGIN_EXECUTION_ERROR",
         { plugin, phase, originalError }
       )
     }
   }

   class ComponentRenderError extends QuartzError {
     constructor(component: string, originalError: Error) {
       super(
         \`Failed to render component "\${component}": \${originalError.message}\`,
         "COMPONENT_RENDER_ERROR",
         { component, originalError }
       )
     }
   }

   class FrontmatterParseError extends QuartzError {
     constructor(file: string, line: number, details: string) {
       super(
         \`Failed to parse frontmatter in "\${file}" at line \${line}: \${details}\`,
         "FRONTMATTER_PARSE_ERROR",
         { file, line, details }
       )
     }
   }

   // Error handling middleware
   class ErrorHandler {
     private static handlers: Map<QuartzErrorCode, (error: QuartzError) => void> = new Map()

     static register(code: QuartzErrorCode, handler: (error: QuartzError) => void) {
       this.handlers.set(code, handler)
     }

     static handle(error: QuartzError) {
       console.error(\`[\${error.code}] \${error.message}\`)

       // Log detailed error information
       if (error.details) {
         console.debug("Error context:", {
           ...error.details,
           stack: error.stack,
         })
       }

       // Call specific handler if registered
       const handler = this.handlers.get(error.code)
       if (handler) {
         handler(error)
       }

       // Default error handling behavior
       switch (error.code) {
         case "PLUGIN_EXECUTION_ERROR":
           this.handlePluginError(error)
           break
         case "COMPONENT_RENDER_ERROR":
           this.handleComponentError(error)
           break
         case "FRONTMATTER_PARSE_ERROR":
           this.handleFrontmatterError(error)
           break
         case "LINK_RESOLUTION_ERROR":
           this.handleLinkError(error)
           break
         case "BUILD_ERROR":
           this.handleBuildError(error)
           break
         default:
           this.handleGenericError(error)
       }
     }

     private static handlePluginError(error: QuartzError) {
       const { plugin, phase } = error.details
       console.error(\`Plugin "\${plugin}" failed during \${phase} phase\`)
       console.error("Consider checking:")
       console.error("1. Plugin configuration in quartz.config.ts")
       console.error("2. Plugin input/output validation")
       console.error("3. Plugin dependencies and version compatibility")
     }

     private static handleComponentError(error: QuartzError) {
       const { component } = error.details
       console.error(\`Component "\${component}" failed to render\`)
       console.error("Consider checking:")
       console.error("1. Component props validation")
       console.error("2. Component lifecycle methods")
       console.error("3. Component dependencies and resource loading")
     }

     private static handleFrontmatterError(error: QuartzError) {
       const { file, line } = error.details
       console.error(\`Frontmatter parse error in "\${file}" at line \${line}\`)
       console.error("Consider checking:")
       console.error("1. YAML syntax")
       console.error("2. Required frontmatter fields")
       console.error("3. Data type validation")
     }

     private static handleLinkError(error: QuartzError) {
       const { file } = error.details
       console.error(\`Link resolution error in "\${file}"\`)
       console.error("Consider checking:")
       console.error("1. Link target existence")
       console.error("2. Link syntax")
       console.error("3. File organization and paths")
     }

     private static handleBuildError(error: QuartzError) {
       console.error("Build process failed")
       console.error("Consider checking:")
       console.error("1. Configuration validity")
       console.error("2. File system permissions")
       console.error("3. Available system resources")
     }

     private static handleGenericError(error: QuartzError) {
       console.error("An unexpected error occurred")
       console.error("Consider checking:")
       console.error("1. System requirements")
       console.error("2. Configuration validity")
       console.error("3. Recent changes or updates")
     }
   }

   // Error recovery strategies
   class ErrorRecovery {
     static async attemptRecovery(error: QuartzError): Promise<boolean> {
       switch (error.code) {
         case "PLUGIN_EXECUTION_ERROR":
           return await this.recoverPluginExecution(error)
         case "RESOURCE_LOAD_ERROR":
           return await this.recoverResourceLoad(error)
         case "BUILD_ERROR":
           return await this.recoverBuild(error)
         default:
           return false
       }
     }

     private static async recoverPluginExecution(error: QuartzError): Promise<boolean> {
       const { plugin } = error.details
       console.log(\`Attempting to recover from plugin execution error in "\${plugin}"\`)

       try {
         // Attempt plugin reload
         await reloadPlugin(plugin)
         return true
       } catch {
         return false
       }
     }

     private static async recoverResourceLoad(error: QuartzError): Promise<boolean> {
       const { file } = error.details
       console.log(\`Attempting to recover from resource load error for "\${file}"\`)

       try {
         // Attempt resource reload
         await reloadResource(file)
         return true
       } catch {
         return false
       }
     }

     private static async recoverBuild(error: QuartzError): Promise<boolean> {
       console.log("Attempting to recover from build error")

       try {
         // Attempt cleanup and rebuild
         await cleanup()
         await rebuild()
         return true
       } catch {
         return false
       }
     }
   }

   // Usage example
   try {
     await buildQuartzSite()
   } catch (error) {
     if (error instanceof QuartzError) {
       ErrorHandler.handle(error)
       const recovered = await ErrorRecovery.attemptRecovery(error)
       if (!recovered) {
         process.exit(1)
       }
     } else {
       throw error
     }
   }
   ```

This technical architecture document now provides comprehensive implementation details that should give AI assistants sufficient context to understand and work with the Quartz codebase effectively.

## Testing Infrastructure

### Test Framework Setup

```typescript
// jest.config.ts
export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/quartz/$1",
    "\\.scss$": "identity-obj-proxy",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "test/tsconfig.json" }],
    "^.+\\.jsx?$": "babel-jest",
  },
  coverageReporters: ["text", "html"],
  collectCoverageFrom: ["quartz/**/*.{ts,tsx}", "!quartz/**/*.d.ts", "!quartz/bootstrap-cli.mjs"],
}
```

### Test Utilities

```typescript
// test/utils.ts
interface TestContext {
  mockFs: typeof fs
  mockCache: BuildCache
  mockPlugins: Map<string, QuartzPlugin>
}

export function createTestContext(): TestContext {
  // Setup mock filesystem
  const mockFs = {
    ...jest.requireActual('fs'),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }

  // Setup mock cache
  const mockCache = new BuildCache()
  jest.spyOn(mockCache, 'get')
  jest.spyOn(mockCache, 'set')

  return {
    mockFs,
    mockCache,
    mockPlugins: new Map()
  }
}

export function createMockComponent(name: string): QuartzComponent {
  return {
    name,
    component: jest.fn().mockReturnValue(<div data-testid={name} />),
    beforeDOMLoaded: jest.fn(),
    afterDOMLoaded: jest.fn()
  }
}

export class TestRenderer {
  private container: HTMLElement

  constructor() {
    this.container = document.createElement('div')
    document.body.appendChild(this.container)
  }

  async render(component: QuartzComponent, props: QuartzComponentProps) {
    // Render component
    const element = component(props)
    this.container.innerHTML = ''
    this.container.appendChild(element)

    // Execute lifecycle hooks
    if (component.beforeDOMLoaded) {
      await new Function(component.beforeDOMLoaded)()
    }
    if (component.afterDOMLoaded) {
      await new Function(component.afterDOMLoaded)()
    }

    return {
      container: this.container,
      rerender: () => this.render(component, props),
      cleanup: () => this.container.remove()
    }
  }
}
```

### Component Testing

```typescript
// test/components/Explorer.test.ts
describe("Explorer Component", () => {
  let renderer: TestRenderer
  let mockProps: QuartzComponentProps

  beforeEach(() => {
    renderer = new TestRenderer()
    mockProps = {
      fileData: {
        slug: "test",
        frontmatter: {},
        links: [],
      },
      allFiles: [
        { slug: "file1", frontmatter: {} },
        { slug: "file2", frontmatter: {} },
      ],
    }
  })

  afterEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  test("renders file tree correctly", async () => {
    const { container } = await renderer.render(Explorer(), mockProps)

    expect(container.querySelector(".explorer")).toBeTruthy()
    expect(container.querySelectorAll(".file").length).toBe(2)
  })

  test("maintains folder state between renders", async () => {
    const { container, rerender } = await renderer.render(Explorer(), mockProps)

    // Open a folder
    const folder = container.querySelector(".folder")
    folder?.click()
    expect(folder?.classList.contains("open")).toBe(true)

    // Rerender and check state persists
    await rerender()
    expect(folder?.classList.contains("open")).toBe(true)
  })
})
```

### Plugin Testing

```typescript
// test/plugins/transformer.test.ts
describe("Transformer Plugin", () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestContext()
  })

  test("transforms markdown content correctly", async () => {
    const plugin = createTransformerPlugin({
      name: "TestTransformer",
      markdownPlugins: () => [remarkGfm],
    })

    const input = "# Test\n\n* Item 1\n* Item 2"
    const output = await plugin.transform(ctx, input)

    expect(output).toContain("<h1>Test</h1>")
    expect(output).toContain("<ul>")
  })

  test("handles plugin errors gracefully", async () => {
    const plugin = createTransformerPlugin({
      name: "ErrorPlugin",
      transform: () => {
        throw new Error("Test error")
      },
    })

    await expect(plugin.transform(ctx, "test")).rejects.toThrow(PluginExecutionError)
  })
})
```

### Performance Testing

```typescript
// test/performance/build.bench.ts
import { performance } from "perf_hooks"

interface BenchmarkResult {
  name: string
  duration: number
  memory: {
    heapUsed: number
    heapTotal: number
  }
}

async function benchmark(name: string, fn: () => Promise<void>): Promise<BenchmarkResult> {
  // Collect garbage before test
  global.gc?.()

  const startMemory = process.memoryUsage()
  const startTime = performance.now()

  await fn()

  const endTime = performance.now()
  const endMemory = process.memoryUsage()

  return {
    name,
    duration: endTime - startTime,
    memory: {
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
    },
  }
}

describe("Build Performance", () => {
  test("build time stays within threshold", async () => {
    const result = await benchmark("full-build", async () => {
      await buildQuartzSite({
        directory: "test/fixtures/content",
        output: "test/fixtures/output",
      })
    })

    expect(result.duration).toBeLessThan(5000) // 5 seconds
    expect(result.memory.heapUsed).toBeLessThan(100 * 1024 * 1024) // 100MB
  })
})
```

## Security Considerations

### Content Security

```typescript
// Security configuration and sanitization
interface SecurityOptions {
  contentSecurityPolicy: boolean
  sanitizeHtml: boolean
  allowedTags: string[]
  allowedAttributes: Record<string, string[]>
}

class ContentSecurity {
  private options: SecurityOptions
  private sanitizer: typeof sanitizeHtml

  constructor(options: SecurityOptions) {
    this.options = {
      contentSecurityPolicy: true,
      sanitizeHtml: true,
      allowedTags: ["a", "p", "h1", "h2", "h3", "ul", "li", "code", "pre"],
      allowedAttributes: {
        a: ["href", "title", "target"],
        code: ["class"],
        pre: ["class"],
      },
      ...options,
    }

    this.sanitizer = sanitizeHtml
  }

  sanitize(content: string): string {
    if (!this.options.sanitizeHtml) {
      return content
    }

    return this.sanitizer(content, {
      allowedTags: this.options.allowedTags,
      allowedAttributes: this.options.allowedAttributes,
      allowedSchemes: ["http", "https", "mailto"],
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: {
            ...attribs,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        }),
      },
    })
  }

  generateCSP(): string {
    if (!this.options.contentSecurityPolicy) {
      return ""
    }

    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
    ].join("; ")
  }
}

// Resource integrity
interface ResourceIntegrity {
  generateIntegrityHash(content: string): string
  validateIntegrity(content: string, hash: string): boolean
}

class SRIManager implements ResourceIntegrity {
  generateIntegrityHash(content: string): string {
    const hash = crypto.createHash("sha384").update(content).digest("base64")

    return `sha384-${hash}`
  }

  validateIntegrity(content: string, hash: string): boolean {
    const [algorithm, expectedHash] = hash.split("-")
    const actualHash = crypto.createHash(algorithm.toLowerCase()).update(content).digest("base64")

    return actualHash === expectedHash
  }
}

// Access control
interface AccessControl {
  isPublic(file: ProcessedContent): boolean
  canAccess(file: ProcessedContent, user?: UserContext): boolean
}

class QuartzAccessControl implements AccessControl {
  isPublic(file: ProcessedContent): boolean {
    return !file.frontmatter.private && !file.frontmatter.draft
  }

  canAccess(file: ProcessedContent, user?: UserContext): boolean {
    if (this.isPublic(file)) {
      return true
    }

    if (!user) {
      return false
    }

    return this.hasPermission(file, user)
  }

  private hasPermission(file: ProcessedContent, user: UserContext): boolean {
    const requiredRoles = file.frontmatter.accessRoles ?? []
    return requiredRoles.some((role) => user.roles.includes(role))
  }
}
```

## Internationalization

### Translation System

```typescript
interface TranslationOptions {
  defaultLocale: string
  fallbackLocale: string
  loadPath: string
  namespaces: string[]
}

class I18nManager {
  private translations: Map<string, Record<string, string>>
  private currentLocale: string
  private options: TranslationOptions

  constructor(options: TranslationOptions) {
    this.options = options
    this.currentLocale = options.defaultLocale
    this.translations = new Map()
  }

  async loadTranslations(locale: string): Promise<void> {
    const translations = await Promise.all(
      this.options.namespaces.map(async namespace => {
        const path = `${this.options.loadPath}/${locale}/${namespace}.json`
        const content = await fs.readFile(path, 'utf-8')
        return [namespace, JSON.parse(content)]
      })
    )

    this.translations.set(locale, Object.fromEntries(translations))
  }

  setLocale(locale: string): void {
    if (!this.translations.has(locale)) {
      console.warn(`Translations for locale ${locale} not loaded`)
      locale = this.options.fallbackLocale
    }
    this.currentLocale = locale
  }

  translate(key: string, params: Record<string, string> = {}): string {
    const translations = this.translations.get(this.currentLocale)
    if (!translations) {
      return key
    }

    let text = translations[key] ?? key
    Object.entries(params).forEach(([param, value]) => {
      text = text.replace(`{${param}}`, value)
    })

    return text
  }
}

// RTL Support
interface RTLOptions {
  rtlLocales: string[]
  transformers: {
    css: (css: string) => string
    layout: (layout: FullPageLayout) => FullPageLayout
  }
}

class RTLManager {
  private options: RTLOptions

  constructor(options: RTLOptions) {
    this.options = {
      rtlLocales: ['ar', 'he', 'fa'],
      transformers: {
        css: (css) => css,
        layout: (layout) => layout
      },
      ...options
    }
  }

  isRTL(locale: string): boolean {
    return this.options.rtlLocales.includes(locale)
  }

  transformCSS(css: string, locale: string): string {
    if (!this.isRTL(locale)) {
      return css
    }

    return this.options.transformers.css(css)
  }

  transformLayout(layout: FullPageLayout, locale: string): FullPageLayout {
    if (!this.isRTL(locale)) {
      return layout
    }

    return this.options.transformers.layout(layout)
  }
}

// Date/Time Formatting
interface DateTimeOptions {
  timezone?: string
  format?: Intl.DateTimeFormatOptions
}

class DateTimeFormatter {
  private formatters: Map<string, Intl.DateTimeFormat>

  constructor() {
    this.formatters = new Map()
  }

  format(date: Date, locale: string, options: DateTimeOptions = {}): string {
    const key = this.getFormatterKey(locale, options)
    let formatter = this.formatters.get(key)

    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale, {
        timeZone: options.timezone,
        ...options.format
      })
      this.formatters.set(key, formatter)
    }

    return formatter.format(date)
  }

  private getFormatterKey(locale: string, options: DateTimeOptions): string {
    return `${locale}-${options.timezone}-${JSON.stringify(options.format)}`
  }
}

// Number Formatting
interface NumberFormatOptions {
  style?: 'decimal' | 'currency' | 'percent'
  currency?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

class NumberFormatter {
  private formatters: Map<string, Intl.NumberFormat>

  constructor() {
    this.formatters = new Map()
  }

  format(number: number, locale: string, options: NumberFormatOptions = {}): string {
    const key = this.getFormatterKey(locale, options)
    let formatter = this.formatters.get(key)

    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, options)
      this.formatters.set(key, formatter)
    }

    return formatter.format(number)
  }

  private getFormatterKey(locale: string, options: NumberFormatOptions): string {
    return `${locale}-${JSON.stringify(options)}`
  }
}

// Usage in components
interface I18nComponentProps extends QuartzComponentProps {
  i18n: I18nManager
  rtl: RTLManager
  dateFormatter: DateTimeFormatter
  numberFormatter: NumberFormatter
}

const LocalizedComponent: QuartzComponent = (props: I18nComponentProps) => {
  const { i18n, rtl, dateFormatter, numberFormatter } = props
  const isRTL = rtl.isRTL(i18n.currentLocale)

  return <div dir={isRTL ? 'rtl' : 'ltr'}>
    <h1>{i18n.translate('title')}</h1>
    <p>{i18n.translate('lastUpdated', {
      date: dateFormatter.format(new Date(), i18n.currentLocale)
    })}</p>
    <p>{i18n.translate('viewCount', {
      count: numberFormatter.format(1234, i18n.currentLocale)
    })}</p>
  </div>
}
```
