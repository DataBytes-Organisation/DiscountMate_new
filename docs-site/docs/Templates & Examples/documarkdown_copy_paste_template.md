---
title: "Docusaurus Copy-Paste Template"
sidebar_label: "Docusaurus Template"
sidebar_position: 1
---
:::important Document Meta data
**Delete this section in actual document:
  Make sure to change the page meta data for the title of the page, and the name of the tab, at the very top of your file**
:::

# Main Header (e.g.): DiscountMate Intro
**Recommend that you copy this template and start writing from here and then utilise any of the templates as you go and then delete any remaining template sections once you've finalised everything.** 

Start with a title and use the # to render a main title. Modify the title

Add some info here...

## Secondary Headers (e.g.): Machine Learning 
Add secondary sub headers like you would in a typical PDF or Word document workflow. use the repeating ## for each sub section...

### Heading 3 (e.g.): LLM RAG
Using ### creates header 3 format, #### creates header 4 and so on up to ###### Heading 6

###### Heading 6 (e.g.): Product Embeddings using sentence transformers

---
use three '-' if you would like a horizontal line separating sections

---

## Lists
use this format if you need to make a list. 
- option 1
- option 2
- option 3

numbered lists:
1. option 1
2. option 2
3. option 4

nested lists:
1. ordered list
    1. nested 1
    2. nested 2
        - double nested 1
        - double nested 2
        1. option a
        2. option b

---
## Styling

using Italics: _italic_

Italics on some words in a sentence: Introduce rate _limiting on critical endpoints such_ as login, signup, password

Strong/Bold format: **strong or bold**

Combining **YOLO** _(object detection)_ and **OCR** _(text recognition)_ technologies will further enhance the ability to accurately detect...

italics and bold:

Combining **_YOLO (object detection) and OCR_**

grey box shading: `I'm shaded in a grey box`

---

## Code Blocks

If you would like to wrap a section in a code block use ```. Anything between two lines that contain these 3 back quotes will be in the block.

```
if __name__ == '__main__':
    print(f"Starting ML/AI Service on port {ML_SERVICE_PORT}")
    print("Available endpoints:")
    print("  GET  /health - Health check")
    print("  GET  /api/weekly-specials - Get this week's top specials")
    print("  POST /api/ml/recommendations - Get product recommendations")
    print("  POST /api/ocr/receipt - Process uploaded receipt image")
    # print("  POST /api/ml/price-prediction - Predict future prices")
    app.run(host='0.0.0.0', port=ML_SERVICE_PORT, debug=True)
```

# Coloured Blocks Admonitions

Use these to highlight or bring attention to various sections in your report

:::note You can add title or just leave ':::note' at the start

This generates a grey block with an i symbol typically used to represent 'information'. Delete this sentence here and add anything noteworthy. You can also add a title in in the 'add title above' or leave it just as note

:::

:::tip[You can specify an optional title]

Heads up! Here's a pro-tip. This generates a green box with a lightbulb icon.

:::

:::info

Useful information. Blue box with an 'i' info icon

:::

:::caution

Warning! This generates a yellow highlighted box with a caution symbol.

:::

:::danger Gemini models are rate limited

Danger danger. This creates a red label box with a fire symbol. 

:::

---

## Creating links
**Use [website name](website link) format**

... we noted the model converged after 90 epochs. For more information see the following link [Kaggle Machine Learning Course](https://www.kaggle.com/learn/intro-to-machine-learning)

**We can also use reference style links**

Machine Learning Prophet models 

Prophet is an open-source, additive, and decomposable time-series forecasting model developed by Meta's Core Data Science team. Designed by [Facebook][1] and you can see more info on this [link][2]

Reference section (end of paper or submission)

List references here:

[1]: https://facebook.github.io/prophet/ "Prophet Model or title"
[2]: https://otexts.com/fpp3/prophet.html "More Prophet Links"

## Add Tables

| Feature 1 | Feature 2 | Target |
| ---- | ---- | ---- |
| 0.005 | Monday | 1 |
| -1.3 | Tuesday | 0 |

## Add Pictures
All main sub team sections have had an /img/ folder created, so add images there and reference them as below. Create an image folder in the sub directory e.g. one image folder in the Templates & Examples section, one image folder in the Machine Learning Section, then reference them via the relative path. 

**Keep image file names and file extensions in lowercase, for example example-image.png rather than Example-Image.PNG. Windows may still load files with mixed casing, but Linux-based environments and deployments can fail if the file name casing does not exactly match the reference.**

```
Use "picture tile: [ name ](link "alt text")"
```

Machine Learning: ![Machine Learning General](img\machinelearning.jpg "ML")

![Machine Learning General2](img\machine-learning2.png "ML")

## Embedding Vidoes (e.g. Youtube or Panopto)
If embedding YouTube videos ensure you select the 'embed' link which is obtained via share --> emebed --> copy only the src and paste it here.  
<div className="video-container" style={{position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', border: '2px solid #2e8555'}}>
  <iframe 
    src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=ay19jGLXuM6xAzU5" 
    style={{
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      border: 'none'
    }} 
    allowFullScreen 
    allow="autoplay; fullscreen" 
  >
  </iframe>
</div>

# Embedding PDFs

See the MDX template:
A quick note on using what's called .mdx features, mdx means markdown extended, to used these features, you need to name your file to have the extension .mdx

