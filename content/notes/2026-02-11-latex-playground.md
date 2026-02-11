---
title: LaTeX 渲染测试（KaTeX）
date: 2026-02-11
categories: [writing, product]
tags: [latex, katex, math]
nodes: [writing-system/typography]
excerpt: "用一篇 Note 覆盖 inline / display / aligned / matrix / cases 等常见公式，顺手确认 Markdown 与数学混排不会炸。"
---

这篇是 **LaTeX / KaTeX 渲染能力的“样例册”**。如果你在改渲染逻辑或样式，拿它当回归测试即可。

> 约定：行内用 `$...$`，块级用 `$$...$$`。`\\(...\\)` / `\\[...\\]` 也会测试一遍。

---

## 1) Inline math（行内）

- 爱因斯坦：$E = mc^2$
- 下标/上标：$x_i$、$a_{i,j}$、$e^{-\lambda t}$
- 希腊字母：$\alpha,\ \beta,\ \Delta,\ \nabla$
- 向量/矩阵：$\mathbf{x}\in\mathbb{R}^d$、$\mathbf{W}\mathbf{x}+\mathbf{b}$
- 范数/内积：$\langle x, y\rangle$、$\lVert x\rVert_2$

顺便测一下 `\\(...\\)`：\\( \mathrm{KL}(p\Vert q)=\sum_x p(x)\log\frac{p(x)}{q(x)} \\)

---

## 2) Display math（块级）

高斯积分：

$$
\int_{0}^{\infty} e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

也测一下 `\\[...\\]`：

\\[
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
\\]

---

## 3) Aligned（对齐多行）

$$
\begin{aligned}
\operatorname{softmax}(z_i) &= \frac{e^{z_i}}{\sum_{j=1}^{n} e^{z_j}} \\
\log p(x) &= \sum_{t=1}^{T}\log p(x_t \mid x_{<t})
\end{aligned}
$$

---

## 4) Cases（分段函数）

$$
f(x)=
\begin{cases}
x^2, & x \ge 0 \\
-x, & x < 0
\end{cases}
$$

---

## 5) Matrix（矩阵）

$$
A=
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
,\quad
\det(A)= -2
$$

---

## 6) Operators（算子 / 期望 / argmin）

$$
\operatorname*{argmin}_{\theta\in\mathbb{R}^{d}}
\ \mathbb{E}_{(x,y)\sim\mathcal{D}}\left[\ell\!\left(f_\theta(x),y\right)\right]
 + \lambda\lVert\theta\rVert_2^2
$$

---

## 7) Markdown 混排（列表 / 表格 / 引用）

1. 列表里也能渲染：$O(n\log n)$、$O(n)$
2. 引用里：> 经验公式：当 $p \to 0$ 时，$\log(1-p)\approx -p$。

表格：

| Symbol | Meaning |
|---|---|
| $x$ | scalar |
| $\mathbf{x}$ | vector |
| $\mathbb{E}[X]$ | expectation |

---

## 8) 不该渲染的地方（code fence / inline code）

代码块里的 `$...$` **不应该**被当成数学渲染：

```txt
Price is $5, not math.
$$ this is not a formula block $$
```

行内代码也一样：`$x_i$`。

---

## 9) 需要转义的美元符号

如果你想写“价格是 \$5”，请写成：`\\$5`（也就是 `\$5`）。

