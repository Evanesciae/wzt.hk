---
title: 1071. Greatest Common Divisor of Strings
summary: 利用字符串拼接判断公共重复基元，并用长度最大公约数求出最大公共字符串。
category: development
tags: [LeetCode, 算法, 字符串, 最大公约数]
createdAt: 2026-08-13
updatedAt: 2026-08-13
draft: false
featured: false
---

## 思路

### 判断两个字符串是否有公共重复基元

```cpp
str1 + str2 == str2 + str1
```

若两种拼接顺序不相等，说明两个字符串不存在公共 divisor，返回 `""`。

### 计算最大公共字符串长度

```cpp
gcd(str1.length(), str2.length())
```

### 取出答案

```cpp
str1.substr(0, gcd(str1.length(), str2.length()))
```

## C++ 解法

```cpp
class Solution {
public:
    string gcdOfStrings(string str1, string str2) {
        if (str1 + str2 != str2 + str1) {
            return "";
        }

        return str1.substr(0, gcd(str1.length(), str2.length()));
    }
};
```

## 核心记忆

> 公共周期判断：`s1 + s2 == s2 + s1`  
> 最大公共周期长度：`gcd(len1, len2)`

## 复杂度

- 时间复杂度：`O(n + m)`
- 额外空间复杂度：`O(n + m)`，主要来自字符串拼接结果
