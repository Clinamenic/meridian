import { QuartzConfig } from "./quartz/cfg"
import \* as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
configuration: {
pageTitle: "Index",
enableSPA: true,
enablePopovers: true,
analytics: {
provider: "plausible",
},
locale: "en-US",
baseUrl: "www.clinamenic.com",
ignorePatterns: ["private", "templates", ".obsidian"],
defaultDateType: "created",
theme: {
fontOrigin: "googleFonts",
cdnCaching: true,
typography: {
header: "IBM Plex Mono",
body: "IBM Plex Mono",
code: "IBM Plex Mono",
},
colors: {
lightMode: {
light: "#fef9eb",
lightgray: "#f2eddf",
gray: "#747E85",
darkgray: "#181D21",
dark: "#000000",
secondary: "#79C57E",
tertiary: "#A1F3A4",
highlight: "rgba(121, 197, 126, 0.15)",
textHighlight: "#fff23688",
},
darkMode: {
light: "#000000",
lightgray: "#181D21",
gray: "#747E85",
darkgray: "#f2eddf",
dark: "#fef9eb",
secondary: "#79C57E",
tertiary: "#A1F3A4",
highlight: "rgba(121, 197, 126, 0.15)",
textHighlight: "#b3aa0288",
},
},
},
},
plugins: {
transformers: [
Plugin.FrontMatter(),
Plugin.CreatedModifiedDate({
priority: ["frontmatter", "filesystem"],
}),
Plugin.SyntaxHighlighting({
theme: {
light: "github-light",
dark: "github-dark",
},
keepBackground: false,
}),
Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
Plugin.GitHubFlavoredMarkdown(),
Plugin.TableOfContents(),
Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
Plugin.Description(),
Plugin.Latex({ renderEngine: "katex" }),
Plugin.Citations({
bibliographyFile: "./bibliography.bib",
linkCitations: true,
}),
],
filters: [
Plugin.RemoveDrafts(),
Plugin.ExplicitPublish(),
],
emitters: [
Plugin.AliasRedirects(),
Plugin.ComponentResources(),
Plugin.ContentPage(),
Plugin.FolderPage(),
Plugin.TagPage(),
Plugin.ContentIndex({
enableSiteMap: true,
enableRSS: true,
}),
Plugin.Assets(),
Plugin.Static(),
Plugin.NotFoundPage(),
],
},
}

export default config
