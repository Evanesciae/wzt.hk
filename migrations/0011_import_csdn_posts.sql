-- Import the 15 original CSDN posts. Dates come from each article's published/modified metadata.

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'minimum-spanning-tree-prim-kruskal',
  '最小生成树（Prim 和 Kruskal）',
  '最小生成树，以及 Prim 算法和 Kruskal 算法介绍。',
  'development',
  '["C++","算法"]',
  '### 最小生成树定义

图的所有生成树中具有边上的权制之和最小的树称为图的最小生成树（Minimum Spanning Tree）

最小生成树在许多领域都有重要的作用，例如：

要在 n 个城市之间铺设光缆，使它们都可以通信

铺设光缆的费用很高，且各个城市之间因为距离不同等因素，铺设光缆的费用也不同

如何使铺设光缆的总费用最低？

![文章配图](/kb-media/csdn/128687434/954ef7b1440db865efdc12a6e602eeb9.png)

图

![文章配图](/kb-media/csdn/128687434/9c9dd8a9bad8dc9fedadb247dc179c95.jpeg)

最小生成树

### Prim算法

**Prim算法本质是一种贪心算法：直接寻找已知点的最小邻边加入即可。**

#### 图解

随机构建一个无向图：

![文章配图](/kb-media/csdn/128687434/ab31cd8815291af22bc9a5c4e3f7414a.png)

同时创建一个dist数组，来记录每个点到当前连通块的距离，起始节点的初始值为0，其它都为正无穷

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dist | 0 | ∞ | ∞ | ∞ | ∞ | ∞ | ∞ |

选择其中一个节点作为起始节点

![文章配图](/kb-media/csdn/128687434/12f6362b0348556b19ff67be007a3cc0.png)

更新dist值

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dist | 0 | 3 | 9 | 7 | ∞ | ∞ | ∞ |

接下来找的最小的邻边，并其连接的点将加入到连通块，

该图中为点2

![文章配图](/kb-media/csdn/128687434/4763b5136eb3ce3c2142d971b01314cc.png)

再由点2更新dist值

|  | 1(visited) | 2(visited) | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dist | 0 | 3 | 9 | 1 | 10 | ∞ | ∞ |

重复以上过程

![文章配图](/kb-media/csdn/128687434/22ddf492a6a5fd3fec878f8711a76e00.png)

点4更新dist值

|  | 1(visited) | 2(visited) | 3 | 4(visited) | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dist | 0 | 3 | 5 | 1 | 8 | 11 | 13 |

![文章配图](/kb-media/csdn/128687434/1a8edbb8232411b3bdf1b1b617b760f7.png)

点3更新dist值

|  | 1(visited) | 2(visited) | 3(visited) | 4(visited) | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dist | 0 | 3 | 5 | 1 | 8 | 9 | 13 |

加入1，2，3，4点后，接下来最短的相邻边长度是7，但是这条边连接的两点都已经加入集合了，所以不能选择这条边

![文章配图](/kb-media/csdn/128687434/ff37b94fa62141ff463c7d97a2f586ac.png)

最终得到了如下图的最小生成树

![文章配图](/kb-media/csdn/128687434/a4cf55055e50009eed09c60a55eca554.png)

题目链接：[Prim – Woozie''s Blog](https://woozie.blog/index.php/2022/10/24/prim-%E6%9C%80%E5%B0%8F%E7%94%9F%E6%88%90%E6%A0%91/)

#### 代码实现：

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=510,M=1e5+10;
int n,m;
int g[N][N];
int dis[N];
bool vis[N];
int prim()
{
	int res=0;//记录最小生成树中边的长度
	memset(dis,0x3f3f3f,sizeof(dis));
	for(int i=0;i<n;i++)
	{
		int t=-1;
		for(int j=1;j<=n;j++)//找最短边
			if(!(vis[j])&&(t==-1||dis[j]<dis[t]))
				t=j;
		if(i&&dis[t]==0x3f3f3f3f)//无最短距离
			return 0x3f3f3f3f;
		if(i)//从第二个开始加入边权
			res+=dis[t];
		vis[t]=true;
		for(int j=1;j<=n;j++)//更新dis值
			dis[j]=min(dis[j],g[t][j]);
	}
	return res;
}
int main()
{
	memset(g,0x3f,sizeof(g));
	scanf("%d%d",&n,&m);
	while(m--)
	{
		int u,v,m;
		scanf("%d%d%d",&u,&v,&m);
		g[u][v]=min(g[u][v],m);
		g[v][u]=min(g[v][u],m);
	}
	int ans=prim();
	if(ans==0x3f3f3f3f)
		printf("impossible");
	else
		printf("%d",ans);
}
```

### Kruskal算法

Kruskal算法的思路是先将边从小到大排序，再依次考察每条边的两点（u，v）来判断是否加入该边

#### 图解

先加入最小的边，连接了2，4

![文章配图](/kb-media/csdn/128687434/a19ef526cee40b1b8c35cc5ad13f91bc.png)

剩余边中连接5，7的最小

![文章配图](/kb-media/csdn/128687434/4ae53a3bc3ce13a0f96c946972a8a1f9.png)

连接1，2的最小，以此类推

![文章配图](/kb-media/csdn/128687434/a377944d50fac0f69258547479c77020.png)

此时连接1，4的边最小，但是1，4已经连通了，所以不加入该边

![文章配图](/kb-media/csdn/128687434/ed6ba70b70c89bd755c0e737be56618a.png)

最终得到最小生成树

![文章配图](/kb-media/csdn/128687434/e04ae97048e692212f3f4fe958efa6b3.png)

有一个关键问题需要解决：**如何判断两点是否在同一个连通块中？**

最简单的方法是用并查集

代码如下：

```cpp
for(int i=1;i<=n;i++) fa[i]=i;//初始化

int find(int x)//寻找并压缩路径{
	if(fa[x]==x) return x;
	return fa[x]=find(fa[x]);
}

fa[find(y)]=fa[find(x)];//合并x所在集合和y所在集合
```

#### 代码实现

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1e5+10;
const int M=2e5+10;
int n,m;
int cnt;//记录边数
int res;//记录最小生成树长度
int fa[N];

struct Edge{
	int a,b,v;
}edge[M];

bool cmp(Edge x,Edge y)//根据边的大小从小到大排序
{
	return x.v<y.v;
}

int find(int x)//并查集
{
	if(fa[x]==x) return x;
	return fa[x]=find(fa[x]);
}

bool Kruskal()
{
	int count=0;//记录加入边的个数
	for(int i=1;i<=cnt;i++)//从小到大循环边
	{
		int x=edge[i].a,y=edge[i].b,z=edge[i].v;
		if(find(x)!=find(y))
		{
			res+=z;
			fa[find(y)]=fa[find(x)];//合并x所在集合和y所在集合
			count++;
		}
	}
	if(count==n-1)//边数为n-1则能构成最小生成树
		return true;
	return false;
}

int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)//初始化
		fa[i]=i;
	while(m--)
	{
		int u,v,w;
		scanf("%d%d%d",&u,&v,&w);
		if(u==v) continue;
		edge[++cnt]={u,v,w};
	}
	sort(edge+1,edge+cnt+1,cmp);
	if(Kruskal())
		printf("%d",res);
	else
		printf("impossible");
}
```

效率上来讲kruskal算法优于Prim，只需要排序一次就能找到最小生成树

但kruskal算法是基于边的算法，更适合于边数少的稀疏图，而Prim算法则更适合稠密图

原文链接：[最小生成树（Prim和Kruskal） – Woozie''s Blog](https://woozie.blog/index.php/2023/01/14/%e6%9c%80%e5%b0%8f%e7%94%9f%e6%88%90%e6%a0%91%ef%bc%88prim%e5%92%8ckruskal%ef%bc%89/)
',
  '2023-01-14',
  '2023-01-15',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'interval-dynamic-programming',
  '动态规划：区间 DP',
  '区间动态规划的基本思路与石子合并问题。',
  'development',
  '["算法","动态规划"]',
  '## 区间dp

求区间最优解，将区间分隔为更小的区间，再由小区间最优解得到大区间最优解

模板

```cpp
for(int len=1;len<=n;len++)  //先枚举长度
{
	for(int i=1;i+len-1<=n;i++)  //枚举起点
	{
		int j=i+len-1;  //由起点和长度得出终点
		for(int k=i;k+1<=j;k++)
			dp[i][j]=max(dp[i][j],dp[i][k]+dp[k+1][j]+______);
	}
}
```

### 线性

石子合并

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=310;
int a[N],b[N],dp[N][N];
int n;
int main()
{
	scanf("%d",&n);
	for(int i=1;i<=n;i++)
	{
		scanf("%d",&a[i]);
		b[i]=b[i-1]+a[i];//记录前缀和
	}
	memset(dp,0x3f3f3f3f,sizeof(dp));//初始化
	for(int len=1;len<=n;len++)
	{
		for(int i=1;i+len-1<=n;i++)
		{
			int j=len+i-1;
			if(len==1)
			{
				dp[i][j]=0;//最小区间
				continue;
			}
			for(int k=i;k<=j-1;k++)
				dp[i][j]=min(dp[i][j],dp[i][k]+dp[k+1][j]+b[j]-b[i-1]);
		}
	}
	printf("%d",dp[1][n]);
}
```

### 环状

思路：将链打开

只需要将前n-1个数复制到后面

如123456 -> 12345612345

最后求max(dp(1,n),dp(2,n+1),......,dp(n,2n-1))

题目：环形石子合并

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=210;
int n;
int dpmax[2*N][2*N],dpmin[2*N][2*N],a[2*N];
int b[2*N];
int main()
{
    scanf("%d",&n);
    for(int i=1;i<=n;i++)
    {
        scanf("%d",&a[i]);
        a[i+n]=a[i];
    }
    for(int i=1;i<=2*n;i++)
        b[i]=b[i-1]+a[i];
    memset(dpmin,0x3f3f3f,sizeof(dpmin));
    memset(dpmax,0,sizeof(dpmax)); //注意预处理！！！！

    for(int len=1;len<=n;len++)
    {
        for(int i=1;i+len-1<=2*n;i++)
        {
            int j=i+len-1;
            if(len==1)
            {
                dpmax[i][i]=0;
                dpmin[i][i]=0;
                continue;
            }
            for(int k=i;k+1<=j;k++)
            {
                dpmin[i][j]=min(dpmin[i][j],dpmin[i][k]+dpmin[k+1][j]+b[j]-b[i-1]);
                dpmax[i][j]=max(dpmax[i][j],dpmax[i][k]+dpmax[k+1][j]+b[j]-b[i-1]);
            }
        }
    }
    int maxn=0,minn=0x3f3f3f;
    for(int i=1;i<=n;i++)
        maxn=max(dpmax[i][i+n-1],maxn),minn=min(dpmin[i][i+n-1],minn);
    printf("%d\n%d",minn,maxn);
}
```
',
  '2023-01-13',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'dynamic-programming-knapsack',
  '动态规划：背包问题',
  '01 背包、完全背包与多重背包的思路和实现。',
  'development',
  '["算法","动态规划","深度优先"]',
  '## **背包**

### 01背包（每个物品只有一个）

#### 朴素01背包

dp[i][j]的含义：前i个物品，容量为j的情况下能装物品的价值最大值

第一层循环——从1到n个物品

第二层循环——从容量0到m

对于第i个物品，当容量为j时

1. v[i]>j 即物品大于容量，不能放，则继承 dp[i][j]=dp[i-1][j];

2. v[i]<=j 选择最大价值 max(dp[i-1][j],dp[i-1][j-v[i]]+w[i]) //dp[i-1][j]为不放直接继承，dp[i-1][j-v[i]]+w[i]为放第i件物品

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;  //n物品个数，m背包容量
int v[N],w[N];  //v物品所占空间，w物品价值
int dp[N][N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
		for(int j=0;j<=m;j++)
			if(j<v[i])
				dp[i][j]=dp[i-1][j];  //继承
			else
				dp[i][j]=max(dp[i-1][j],dp[i-1][j-v[i]]+w[i]);  //更新
	printf("%d",dp[n][m]);
}
```

#### 01背包一维数组优化

dp[i][j]能求得任意i，j情况下的最优解，但由于最终只需要求dp[n][m]，所以只需要一维就可以维持

**枚举背包容量需要逆序！**

简单来说因为正序会使后面要用到的数据被覆盖，而倒序不会出现这个问题。

具体来讲我也忘了

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;
int v[N],w[N];
int dp[N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
		for(int j=m;j>=v[i];j--)
			dp[j]=max(dp[j],dp[j-v[i]]+w[i]);  //倒序，防止覆盖
	printf("%d",dp[m]);
}
```

### 完全背包（物品无限）

#### 朴素完全背包

第一层循环——枚举物品

第二层循环——枚举容量

**第三层循环——枚举个数 条件为k*v[i]<=j，超过容量即退出**

**递推式 dp[i][j]=max(dp[i][j],dp[i-1][j-k*v[i]]+k*w[i]) 前者表示维持当前最大值，后者表示取k个i物品**

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;
int v[N],w[N];
int dp[N][N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
		for(int j=0;j<=m;j++)
			for(int k=0;k*v[i]<=j;k++)
				dp[i][j]=max(dp[i][j],dp[i-1][j-k*v[i]]+k*w[i]);
	printf("%d",dp[n][m]);
}
```

#### 完全背包优化

优化思路

```cpp
f[i , j ] = max( f[i-1,j] , f[i-1,j-v]+w ,  f[i-1,j-2*v]+2*w , f[i-1,j-3*v]+3*w , .....)
f[i , j-v]= max( f[i-1,j-v]   ,  f[i-1,j-2*v] + w , f[i-1,j-3*v]+2*w , .....)
由上两式，可得出如下递推关系：
f[i][j]=max(f[i,j-v]+w , f[i-1][j])
```

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;
int v[N],w[N];
int dp[N][N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
	{
		for(int j=0;j<=m;j++)  //从小到大枚举，与01背包不同
		{
			dp[i][j]=dp[i-1][j];
			if(j>=v[i])
				dp[i][j]=max(dp[i][j],dp[i][j-v[i]]+w[i]);
		}
	}
	printf("%d",dp[n][m]);
}
```

#### 完全背包一维优化

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;
int v[N],w[N];
int dp[N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
		for(int j=v[i];j<=m;j++)
			dp[j]=max(dp[j],dp[j-v[i]]+w[i]);
	printf("%d",dp[m]);
}
```

### 多重背包（物品有限）

01背包是特殊的多重背包

代码与01背包雷同

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=110;
int n,m;
int v[N],w[N],s[N];
int dp[N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d%d",&v[i],&w[i],&s[i]);
	for(int i=1;i<=n;i++)
		for(int j=m;j>=v[i];j--)
			for(int k=0;k<=s[i]&&k*v[i]<=j;k++)  //01背包的k相当于恒为1
				dp[j]=max(dp[j-k*v[i]]+k*w[i],dp[j]);
	printf("%d",dp[m]);
}
```
',
  '2023-01-13',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'random-image-api',
  '创建随机图片 API',
  '使用 PHP 创建一个简单的随机图片 API。',
  'development',
  '["php","开发语言"]',
  '原文链接：

[创建随机图片API – Woozie''s Blog](https://woozie.blog/index.php/2022/12/01/%E5%88%9B%E5%BB%BA%E9%9A%8F%E6%9C%BA%E5%9B%BE%E7%89%87api/)

宝塔新建网站

在根目录添加 img.php 文件

添加以下代码

```php
<?php
$img_array = glob("这里替换成存图片文件夹名称/*.{gif,jpg,png,JPG}",GLOB_BRACE);
$img = array_rand($img_array);
$dz = $img_array[$img];
header("Location:".$dz);
?>
```

在img.php同一目录下添加文件夹，图片上传到该文件夹

访问 网址/img.php就能调用API了
',
  '2022-12-01',
  '2022-12-01',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'domain-name-resolution',
  '域名解析方法',
  '从域名购买到 DNS 解析、A 记录配置与结果验证。',
  'development',
  '["服务器","linux","网络"]',
  '博客链接：[域名解析 – Woozie''s Blog](https://woozie.blog/index.php/2022/11/25/%E5%9F%9F%E5%90%8D%E8%A7%A3%E6%9E%90/)

域名购买：[NameSilo](https://www.namesilo.com/)

点击Manage My Domains

![文章配图](/kb-media/csdn/128036404/8e9722749a9f8a5fb8d31739c8fe82fe.png)

先找到DNS Records，将里面的解析记录全部删除

![文章配图](/kb-media/csdn/128036404/09a609751f7da11fe05bbb77d8cda184.png)

然后把域名的Name Servers换为云服务器的所在的Name Servers

以华为云为例：

![文章配图](/kb-media/csdn/128036404/00605c5c47d6906c41192146d6bee9a6.png)

登录华为云，找到云解析，点击公网域名

![文章配图](/kb-media/csdn/128036404/1ecd4926bc3b6be65e1b7807ce0cea33.png)

点击管理解析

![文章配图](/kb-media/csdn/128036404/3d39d5e13c23b74bab097efeb846d65f.png)

点击快速添加解析

![文章配图](/kb-media/csdn/128036404/c0d4e350fdc68bcabdd962f8d9a7c50e.png)

添加两条A记录（IP地址为服务器公网地址，TTL值也可以设置为600，3600）

解析域名需要一段时间，一般来讲几分钟就行了，最多的好像要48小时

查询网址：[infocode.com.cn](https://www.infocode.com.cn/domain/)

![文章配图](/kb-media/csdn/128036404/7020869b87afba18867e5ebf38009629.png)

查询成功说明解析完成
',
  '2022-11-25',
  '2022-11-25',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'dijkstra-algorithm',
  'Dijkstra 算法',
  '朴素 Dijkstra 算法求单源最短路径。',
  'development',
  '["C++","算法"]',
  '朴素dijkstra

进行n次迭代去确定每个点到起点的最小值

最后输出的终点即为要找的最短路的距离

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=510;
int n,m;
int dist[N],s[N][N];
bool flag[N];
int dijkstra()
{
    memset(dist,0x3f,sizeof dist);
    dist[1]=0;
    for(int i=1;i<=n;i++)
    {
        int t=-1;
        for(int j=1;j<=n;j++)//寻找未确定点中最短距离
        {
            if((!flag[j])&&(t==-1||dist[j]<dist[t]))
                t=j;
        }
        flag[t]=true;
        for(int j=1;j<=n;j++)
            dist[j]=min(dist[j],dist[t]+s[t][j]);//由新的确定点更新距离
    }
    if(dist[n]==0x3f3f3f3f) return -1;
    return dist[n];
}
int main()
{
    memset(s,0x3f,sizeof s);
    scanf("%d%d",&n,&m);
    int x,y,z;
    for(int i=1;i<=m;i++)
    {
        scanf("%d%d%d",&x,&y,&z);
        s[x][y]=min(z,s[x][y]);//防自环
    }
    int ans=dijkstra();
    printf("%d",ans);
}
```
',
  '2022-09-23',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'binary-indexed-tree',
  '树状数组',
  '使用 lowbit 实现树状数组的前缀和查询与区间修改。',
  'development',
  '["C++","算法","数据结构"]',
  '#### lowbit

x&(-x)，当x为0时结果为0；x为奇数时，结果为1；x为偶数时，结果为x中2的最大次方的因子。

```cpp
int lowbit(int x)
{
	return x&(-x);
}
```

功能1：求前缀和

功能2：支持单点修改

#### 模板

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=500010;
int n,m;
int a[N],c[N];
int lowbit(int x)
{
	return x&(-x);
}
void add(int x,int k)
{
	while(x<=n)
	{
		c[x]+=k;
		x+=lowbit(x);
	}
}
int sum(int x)
{
	int A=0;
	while(x>0)
	{
		A+=c[x];
		x-=lowbit(x);
	}
	return A;
}
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
	{
		scanf("%d",&a[i]);
		add(i,a[i]);  //建树
	}
	while(m--)
	{
		int t,b,c;
		scanf("%d%d%d",&t,&b,&c);

		if(t==1)
			add(b,c);
		else
			printf("%d\n",sum(c)-sum(b-1);
	}
}
```

区间修改 单点查询：

差分

```cpp
#include<bits/stdc++.h>
#define ll long long
using namespace std;
const int N=500010;
ll n,m;
ll a[N],difa[N];
ll lowbit(ll x)
{
	return x&(-x);
}
void adddif(ll x,ll k)
{
	while(x<=n)
	{
		difa[x]+=k;
		x+=lowbit(x);
	}
}
ll sumdif(ll x)
{
	ll cnt=0;
	while(x)
	{
		cnt+=difa[x];
		x-=lowbit(x);
	}
	return cnt;
}
int main()
{
	scanf("%lld%lld",&n,&m);
	for(int i=1;i<=n;i++)
	{
		scanf("%lld",&a[i]);
		adddif(i,a[i]-a[i-1]);
	}
	while(m--)
	{
		ll v;
		scanf("%lld",&v);
		if(v==1)
		{
			ll x,y,k;
			scanf("%lld%lld%lld",&x,&y,&k);
			adddif(x,k);
			adddif(y+1,-k);
		}
		else
		{
			ll x;
			scanf("%lld",&x);
			printf("%lld\n",sumdif(x));
		}
	}
}
```
',
  '2022-09-07',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'inversion-count-with-merge-sort',
  '归并排序求逆序对',
  '在归并排序过程中统计数列中的逆序对。',
  'development',
  '["算法","排序算法","数据结构"]',
  '###

给定一个长度为 n 的整数数列，请你计算数列中的逆序对的数量。

逆序对的定义如下：对于数列的第 i 个和第 j 个元素，如果满足i<j 且 a[i]>a[j]，则其为一个逆序对；否则不是。

输入格式

第一行包含整数 n，表示数列的长度。

第二行包含 n 个整数，表示整个数列。

输出格式

输出一个整数，表示逆序对的个数。

数据范围

1≤n≤100000，

数列中的元素的取值范围 [1,109]。

输入样例：

```cobol
6
2 3 4 5 6 1
```

输出样例：

```cobol
5
```

```cpp
#include<bits/stdc++.h>
#define ll long long
using namespace std;
const ll N=1e5+10;
ll n;
ll a[N],r[N];
ll cnt;
void ssort(ll s,ll t)
{
	if(s==t)//一个数字无需排序
		return;
	ll mid=(s+t)/2;
	ssort(s,mid);
	ssort(mid+1,t);
	ll i=s,j=mid+1,now=s;
	while(i<=mid&&j<=t)
	{
		if(a[j]>=a[i])
		{
			r[now]=a[i];
			i++;
			now++;
		}
		else
		{
			cnt+=mid-i+1;
			r[now]=a[j];
			j++;
			now++;
		}
	}
	while(i<=mid)//复制左边剩余
	{
		r[now]=a[i];
		i++;
		now++;
	}
	while(j<=t)//复制右边剩余
	{
		r[now]=a[j];
		j++;
		now++;
	}
	for(ll k=s;k<=t;k++)
		a[k]=r[k];
	return;
}
int main()
{
	scanf("%lld",&n);
	for(ll i=1;i<=n;i++)
		scanf("%lld",&a[i]);
	ssort(1,n);
	printf("%lld",cnt);
}
```
',
  '2022-09-06',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'disjoint-set-union',
  '并查集用法',
  '并查集的查找、路径压缩与集合合并。',
  'development',
  '["C++","算法"]',
  '核心函数find()

```cpp
int find(int x)  //找到祖宗节点并连接到祖宗节点上
{
	if(fa[x]!=x)
		fa[x]=find(fa[x]);
	return fa[x];
}

int find(int x)  //另一种写法
{
    if(fa[x]==x)
        return x;
    return fa[x]=find(fa[x]);
}
```

一共有 n 个数，编号是1∼n，最开始每个数各自在一个集合中。

现在要进行 m 个操作，操作共有两种：

1. M a b，将编号为 a 和 b 的两个数所在的集合合并，如果两个数已经在同一个集合中，则忽略这个操作；
2. Q a b，询问编号为 a 和 b 的两个数是否在同一个集合中；

输入格式

第一行输入整数 n 和 m。

接下来 m 行，每行包含一个操作指令，指令为 M a b 或 Q a b 中的一种。

输出格式

对于每个询问指令 Q a b，都要输出一个结果，如果 a 和 b 在同一集合内，则输出 Yes，否则输出 No。

每个结果占一行。

数据范围

1≤n,m≤10e5

输入样例：

```cobol
4 5
M 1 2
M 3 4
Q 1 2
Q 1 3
Q 3 4
```

输出样例：

```cobol
Yes
No
Yes
```

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1e5+10;
int n,m;
int fa[N];
int find(int x)
{
    if(fa[x]!=x)
        fa[x]=find(fa[x]);
    return fa[x];
}
int main()
{
    scanf("%d%d",&n,&m);
    for(int i=1;i<=n;i++)
        fa[i]=i;
    while(m--)
    {
        char c;
        int a,b;
        do{
            c=getchar();
        }while(c!=''M''&&c!=''Q'');
        scanf("%d%d",&a,&b);
        if(c==''M'')
            fa[find(a)]=find(b);  //结合操作
        if(c==''Q'')
            if(find(a)==find(b))
                printf("Yes\n");
            else
                printf("No\n");
    }
}
```
',
  '2022-08-30',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'linear-dp-passing-notes',
  '线性 DP：传纸条',
  '使用动态规划解决传纸条问题。',
  'development',
  '["算法","C++","动态规划"]',
  '、、小渊和小轩是好朋友也是同班同学，他们在一起总有谈不完的话题。

一次素质拓展活动中，班上同学安排坐成一个 m 行 n 列的矩阵，而小渊和小轩被安排在矩阵对角线的两端，因此，他们就无法直接交谈了。

幸运的是，他们可以通过传纸条来进行交流。

纸条要经由许多同学传到对方手里，小渊坐在矩阵的左上角，坐标 (1,1)，小轩坐在矩阵的右下角，坐标 (m,n)。

从小渊传到小轩的纸条只可以向下或者向右传递，从小轩传给小渊的纸条只可以向上或者向左传递。

在活动进行中，小渊希望给小轩传递一张纸条，同时希望小轩给他回复。

班里每个同学都可以帮他们传递，但只会帮他们一次，也就是说如果此人在小渊递给小轩纸条的时候帮忙，那么在小轩递给小渊的时候就不会再帮忙，反之亦然。

还有一件事情需要注意，全班每个同学愿意帮忙的好感度有高有低（注意：小渊和小轩的好心程度没有定义，输入时用 0 表示），可以用一个0∼100 的自然数来表示，数越大表示越好心。

小渊和小轩希望尽可能找好心程度高的同学来帮忙传纸条，即找到来回两条传递路径，使得这两条路径上同学的好心程度之和最大。

现在，请你帮助小渊和小轩找到这样的两条路径。

输入格式

第一行有 2 个用空格隔开的整数 m 和 n，表示学生矩阵有 m 行 n 列。

接下来的 m 行是一个 m×n 的矩阵，矩阵中第 i行 j列的整数表示坐在第 i 行 j列的学生的好心程度，每行的 n 个整数之间用空格隔开。

输出格式

输出一个整数，表示来回两条路上参与传递纸条的学生的好心程度之和的最大值。

数据范围

1≤n,m≤50

输入样例：

```cobol
3 3
0 3 9
2 8 5
5 7 0
```

输出样例：

```cobol
34
```

与方格取数代码完全相同

因为重复的路径不是最优解

绕道的路径一定不比重复的路径差

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=51;
int n,m;
int dp[N][N][N][N];
int a[N][N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		for(int j=1;j<=m;j++)
			scanf("%d",&a[i][j]);
	for(int i=1;i<=n;i++)
		for(int j=1;j<=m;j++)
			for(int k=1;k<=n;k++)
				for(int l=1;l<=m;l++)
				{
					dp[i][j][k][l]=max(max(dp[i-1][j][k-1][l],dp[i-1][j][k][l-1]),max(dp[i][j-1][k-1][l],dp[i][j-1][k][l-1]))+a[i][j]+a[k][l];
					if(i==k&&j==l)
						dp[i][j][k][l]-=a[i][j];
				}
	printf("%d",dp[n][m][n][m]);
}
```
',
  '2022-08-27',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'huffman-tree-merging-fruit',
  '哈夫曼树：合并果子',
  '使用哈夫曼树思想求合并果子的最小体力消耗。',
  'development',
  '["C++","算法"]',
  '在一个果园里，达达已经将所有的果子打了下来，而且按果子的不同种类分成了不同的堆。

达达决定把所有的果子合成一堆。

每一次合并，达达可以把两堆果子合并到一起，消耗的体力等于两堆果子的重量之和。

可以看出，所有的果子经过 n−1 次合并之后，就只剩下一堆了。

达达在合并果子时总共消耗的体力等于每次合并所耗体力之和。

因为还要花大力气把这些果子搬回家，所以达达在合并果子时要尽可能地节省体力。

假定每个果子重量都为 1，并且已知果子的种类数和每种果子的数目，你的任务是设计出合并的次序方案，使达达耗费的体力最少，并输出这个最小的体力耗费值。

例如有 3 种果子，数目依次为 1，2，9。

可以先将 1、2堆合并，新堆数目为 3，耗费体力为 3。

接着，将新堆与原先的第三堆合并，又得到新的堆，数目为 12，耗费体力为 12。

所以达达总共耗费体力=3+12=15。

可以证明 15为最小的体力耗费值。

输入格式

输入包括两行，第一行是一个整数 n，表示果子的种类数。

第二行包含 n个整数，用空格分隔，第 i 个整数 ai 是第 i 种果子的数目。

输出格式

输出包括一行，这一行只包含一个整数，也就是最小的体力耗费值。

输入数据保证这个值小于 2^31。

数据范围

1≤n≤10000

1≤ai≤20000

输入样例：

```cobol
3
1 2 9
```

输出样例：

```cobol
15
```

```cpp
#include<bits/stdc++.h>
using namespace std;
int n,ans;
priority_queue<int,vector<int>,greater<int> >h;
int main()
{
	scanf("%d",&n);
	for(int i=1;i<=n;i++)
	{
		int x;
		scanf("%d",&x);
		h.push(x);
	}
	for(int i=1;i<n;i++)
	{
		int x=h.top();
		h.pop();
		int y=h.top();
		h.pop();
		ans+=x+y;
		h.push(x+y);
	}
	printf("%d",ans);
}
```
',
  '2022-08-25',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'dynamic-programming-notes',
  '动态规划 DP',
  '背包、区间 DP、线性 DP 与计数 DP 的学习笔记。',
  'development',
  '["动态规划","算法","C++"]',
  '原文链接：[https://woozie.blog/index.php/2022/10/09/26/](https://woozie.blog/index.php/2022/10/09/26/)

**目录**

[背包](#%E8%83%8C%E5%8C%85)

[01背包（每个物品只有一个）](#01%E8%83%8C%E5%8C%85)

[朴素01背包](#%E6%9C%B4%E7%B4%A001%E8%83%8C%E5%8C%85)

[01背包一维数组优化](#01%E8%83%8C%E5%8C%85%E4%B8%80%E7%BB%B4%E6%95%B0%E7%BB%84%E4%BC%98%E5%8C%96)

[完全背包（物品无限）](#%E5%AE%8C%E5%85%A8%E8%83%8C%E5%8C%85)

[朴素完全背包](#%E6%9C%B4%E7%B4%A0%E5%AE%8C%E5%85%A8%E8%83%8C%E5%8C%85)

[完全背包优化](#%E5%AE%8C%E5%85%A8%E8%83%8C%E5%8C%85%E4%BC%98%E5%8C%96)

[完全背包一维优化](#%E5%AE%8C%E5%85%A8%E8%83%8C%E5%8C%85%E4%B8%80%E7%BB%B4%E4%BC%98%E5%8C%96)

[多重背包（物品有限）](#%E5%A4%9A%E9%87%8D%E8%83%8C%E5%8C%85)

[区间dp](#%E5%8C%BA%E9%97%B4dp)

[线性](#%E7%BA%BF%E6%80%A7)

[环状](#%E7%8E%AF%E7%8A%B6)

[计数dp](#%E8%AE%A1%E6%95%B0dp)

[线性dp](#%E7%BA%BF%E6%80%A7dp)

## **背包**

### 01背包（每个物品只有一个）

#### 朴素01背包

dp[i][j]的含义：前i个物品，容量为j的情况下能装物品的价值最大值

第一层循环——从1到n个物品

第二层循环——从容量0到m

对于第i个物品，当容量为j时

1. v[i]>j 即物品大于容量，不能放，则继承 dp[i][j]=dp[i-1][j];

2. v[i]<=j 选择最大价值 max(dp[i-1][j],dp[i-1][j-v[i]]+w[i]) //dp[i-1][j]为不放直接继承，dp[i-1][j-v[i]]+w[i]为放第i件物品

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;  //n物品个数，m背包容量
int v[N],w[N];  //v物品所占空间，w物品价值
int dp[N][N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
		for(int j=0;j<=m;j++)
			if(j<v[i])
				dp[i][j]=dp[i-1][j];  //继承
			else
				dp[i][j]=max(dp[i-1][j],dp[i-1][j-v[i]]+w[i]);  //更新
	printf("%d",dp[n][m]);
}
```

#### 01背包一维数组优化

dp[i][j]能求得任意i，j情况下的最优解，但由于最终只需要求dp[n][m]，所以只需要一维就可以维持

**枚举背包容量需要逆序！**

简单来说因为正序会使后面要用到的数据被覆盖，而倒序不会出现这个问题。

具体来讲我也忘了

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;
int v[N],w[N];
int dp[N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
		for(int j=m;j>=v[i];j--)
			dp[j]=max(dp[j],dp[j-v[i]]+w[i]);  //倒序，防止覆盖
	printf("%d",dp[m]);
}
```

### 完全背包（物品无限）

#### 朴素完全背包

第一层循环——枚举物品

第二层循环——枚举容量

**第三层循环——枚举个数 条件为k*v[i]<=j，超过容量即退出**

**递推式 dp[i][j]=max(dp[i][j],dp[i-1][j-k*v[i]]+k*w[i]) 前者表示维持当前最大值，后者表示取k个i物品**

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;
int v[N],w[N];
int dp[N][N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
		for(int j=0;j<=m;j++)
			for(int k=0;k*v[i]<=j;k++)
				dp[i][j]=max(dp[i][j],dp[i-1][j-k*v[i]]+k*w[i]);
	printf("%d",dp[n][m]);
}
```

#### 完全背包优化

优化思路

```cpp
f[i , j ] = max( f[i-1,j] , f[i-1,j-v]+w ,  f[i-1,j-2*v]+2*w , f[i-1,j-3*v]+3*w , .....)
f[i , j-v]= max( f[i-1,j-v]   ,  f[i-1,j-2*v] + w , f[i-1,j-3*v]+2*w , .....)
由上两式，可得出如下递推关系：
f[i][j]=max(f[i,j-v]+w , f[i-1][j])
```

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;
int v[N],w[N];
int dp[N][N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
	{
		for(int j=0;j<=m;j++)  //从小到大枚举，与01背包不同
		{
			dp[i][j]=dp[i-1][j];
			if(j>=v[i])
				dp[i][j]=max(dp[i][j],dp[i][j-v[i]]+w[i]);
		}
	}
	printf("%d",dp[n][m]);
}
```

#### 完全背包一维优化

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;
int v[N],w[N];
int dp[N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d",&v[i],&w[i]);
	for(int i=1;i<=n;i++)
		for(int j=v[i];j<=m;j++)
			dp[j]=max(dp[j],dp[j-v[i]]+w[i]);
	printf("%d",dp[m]);
}
```

### 多重背包（物品有限）

01背包是特殊的多重背包

代码与01背包雷同

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=110;
int n,m;
int v[N],w[N],s[N];
int dp[N];
int main()
{
	scanf("%d%d",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%d%d%d",&v[i],&w[i],&s[i]);
	for(int i=1;i<=n;i++)
		for(int j=m;j>=v[i];j--)
			for(int k=0;k<=s[i]&&k*v[i]<=j;k++)  //01背包的k相当于恒为1
				dp[j]=max(dp[j-k*v[i]]+k*w[i],dp[j]);
	printf("%d",dp[m]);
}
```

## 区间dp

求区间最优解，将区间分隔为更小的区间，再由小区间最优解得到大区间最优解

模板

```cpp
for(int len=1;len<=n;len++)  //先枚举长度
{
	for(int i=1;i+len-1<=n;i++)  //枚举起点
	{
		int j=i+len-1;  //由起点和长度得出终点
		for(int k=i;k+1<=j;k++)
			dp[i][j]=max(dp[i][j],dp[i][k]+dp[k+1][j]+______);
	}
}
```

### 线性

石子合并

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=310;
int a[N],b[N],dp[N][N];
int n;
int main()
{
	scanf("%d",&n);
	for(int i=1;i<=n;i++)
	{
		scanf("%d",&a[i]);
		b[i]=b[i-1]+a[i];//记录前缀和
	}
	memset(dp,0x3f3f3f3f,sizeof(dp));//初始化
	for(int len=1;len<=n;len++)
	{
		for(int i=1;i+len-1<=n;i++)
		{
			int j=len+i-1;
			if(len==1)
			{
				dp[i][j]=0;//最小区间
				continue;
			}
			for(int k=i;k<=j-1;k++)
				dp[i][j]=min(dp[i][j],dp[i][k]+dp[k+1][j]+b[j]-b[i-1]);
		}
	}
	printf("%d",dp[1][n]);
}
```

### 环状

思路：将链打开

只需要将前n-1个数复制到后面

如123456 -> 12345612345

最后求max(dp(1,n),dp(2,n+1),......,dp(n,2n-1))

题目：环形石子合并

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=210;
int n;
int dpmax[2*N][2*N],dpmin[2*N][2*N],a[2*N];
int b[2*N];
int main()
{
    scanf("%d",&n);
    for(int i=1;i<=n;i++)
    {
        scanf("%d",&a[i]);
        a[i+n]=a[i];
    }
    for(int i=1;i<=2*n;i++)
        b[i]=b[i-1]+a[i];
    memset(dpmin,0x3f3f3f,sizeof(dpmin));
    memset(dpmax,0,sizeof(dpmax)); //注意预处理！！！！

    for(int len=1;len<=n;len++)
    {
        for(int i=1;i+len-1<=2*n;i++)
        {
            int j=i+len-1;
            if(len==1)
            {
                dpmax[i][i]=0;
                dpmin[i][i]=0;
                continue;
            }
            for(int k=i;k+1<=j;k++)
            {
                dpmin[i][j]=min(dpmin[i][j],dpmin[i][k]+dpmin[k+1][j]+b[j]-b[i-1]);
                dpmax[i][j]=max(dpmax[i][j],dpmax[i][k]+dpmax[k+1][j]+b[j]-b[i-1]);
            }
        }
    }
    int maxn=0,minn=0x3f3f3f;
    for(int i=1;i<=n;i++)
        maxn=max(dpmax[i][i+n-1],maxn),minn=min(dpmin[i][i+n-1],minn);
    printf("%d\n%d",minn,maxn);
}
```

## 计数dp

AcWing 900. 整数划分
 题意：一个正整数 n 可以表示成若干个正整数之和，形如：n=n1+n2+…+nk，其中 n1≥n2≥…≥nk,k≥1。有多少种表示方法。

可转化为完全背包

有容量为1~n的n种物品，使背包容量恰好为n，问有多少种放法

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
const int MOD=1e9+7;
int n;
int dp[N];
int main()
{
	scanf("%d",&n);
	dp[0]=1;    //0有一种放法，后面的状态全由0转移出来
	for(int i=1;i<=n;i++)
		for(int j=i;j<=n;j++)
		{
			dp[j]+=dp[j-i];
			dp[j]%=MOD;
		}
	printf("%d",dp[n]);
}
```

Acwing 1021. 货币系统

给你一个n种面值的货币系统，求组成面值为m的货币有多少种方案。

输入格式

第一行，包含两个整数n和m。

接下来n行，每行包含一个整数，表示一种货币的面值。

输出格式

共一行，包含一个整数，表示方案数。

数据范围

n≤15,m≤3000

输入样例：

```cobol
3 10
1
2
5
```

输出样例：

```cobol
10
```

```cpp
#include<bits/stdc++.h>
#define ll long long
using namespace std;
const int N=20;
const int M=3010;
ll n,m;
ll dp[M],a[N];
int main()
{
	scanf("%lld%lld",&n,&m);
	for(int i=1;i<=n;i++)
		scanf("%lld",&a[i]);
	dp[0]=1;
	for(int i=1;i<=n;i++)
		for(int j=a[i];j<=m;j++)
			dp[j]+=dp[j-a[i]];
	printf("%lld",dp[m]);
}
```

## 线性dp

##

最长上升子序列

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n;
int a[N],dp[N];
int main()
{
    scanf("%d",&n);
    for(int i=1;i<=n;i++)
        scanf("%d",&a[i]);
    for(int i=1;i<=n;i++)
    {
        dp[i]=1;
        for(int j=1;j<=i;j++)
            if(a[j]<a[i])
                dp[i]=max(dp[i],dp[j]+1);
    }
    int res=0;
    for(int i=1;i<=n;i++)
        res=max(res,dp[i]);
    printf("%d",res);
}
```

最短编辑距离

```cpp
#include<bits/stdc++.h>
using namespace std;
const int N=1010;
int n,m;
string a,b;
int dp[N][N];
int main()
{
    scanf("%d",&n);
    cin>>a;
    scanf("%d",&m);
    cin>>b;
    memset(dp,0x3f3f3f3f,sizeof(dp));  //求最小值要初始化！！！！
    for(int i=1;i<=n;i++)  //初始化
        dp[i][0]=i;
    for(int i=0;i<=m;i++)  //初始化
        dp[0][i]=i;
    for(int i=0;i<n;i++)
        for(int j=0;j<m;j++)
        {
            int x=i+1,y=j+1;
            dp[x][y]=min(dp[x-1][y-1],min(dp[x-1][y],dp[x][y-1]))+1;
            if(a[i]==b[j])
                dp[x][y]=min(dp[x][y],dp[x-1][y-1]);
        }
    printf("%d",dp[n][m]);
}
```
',
  '2022-08-20',
  '2022-11-04',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'high-precision-arithmetic',
  '高精度算法',
  '高精度加法、减法与乘法的实现。',
  'development',
  '["C++","算法"]',
  'vector写法

**高精度加法**

```cpp
​
#include<bits/stdc++.h>
using namespace std;
string a,b;
vector<int>A,B,C;
vector<int> add(vector<int>x,vector<int>y)
{
	vector<int>z;
	int t=0;
	for(int i=0;i<x.size()||i<y.size();i++)
	{

		if(i<x.size())
			t+=x[i];
		if(i<y.size())
			t+=y[i];
		z.push_back(t%10);
		t=t/10;
	}
	if(t)
		z.push_back(1);
	return z;
}
int main()
{
	cin>>a>>b;
	for(int i=a.size()-1;i>=0;i--)
		A.push_back(a[i]-''0'');
	for(int i=b.size()-1;i>=0;i--)
		B.push_back(b[i]-''0'');
	C=add(A,B);
	for(int i=C.size()-1;i>=0;i--)
		printf("%d",C[i]);
}

​
```

**高精度减法**

```cpp
#include<bits/stdc++.h>
using namespace std;
string a,b;
vector<int>A,B,C;
vector<int> sub(vector<int>x,vector<int>y)
{
	vector<int>z;
	int t=0;
	for(int i=0;i<x.size();i++)
	{
		t=x[i]+t;
		if(i<y.size())
			t-=y[i];
		z.push_back((t+10)%10);
		if(t<0)
			t=-1;
		else
			t=0;
	}
	while(z.size()>1&&z.back()==0) //去除前导0
		z.pop_back();
	return z;
}
int main()
{
	cin>>a>>b;

	//确保A>B
	if(a.size()<b.size())
	{
		string c=b;
		b=a;
		a=c;
		printf("-");
	}
	else if(a.size()==b.size())
	{
		if(a<b)
		{
			string c=b;
			b=a;
			a=c;
			printf("-");
		}
	}
	for(int i=a.size()-1;i>=0;i--)
		A.push_back(a[i]-''0'');
	for(int i=b.size()-1;i>=0;i--)
		B.push_back(b[i]-''0'');
	C=sub(A,B);
	for(int i=C.size()-1;i>=0;i--)
		printf("%d",C[i]);
}
```

高精度乘法

```cpp
#include<bits/stdc++.h>
using namespace std;
vector<int> A,B;
string a,b;
vector<int> mul(vector<int> x,vector<int> y)
{
	vector<int> C(x.size()+y.size()+5);
	for(int i=0;i<x.size();i++)
		for(int j=0;j<y.size();j++)
			C[i+j]+=x[i]*y[j];
	int t=0;
	for(int i=0;i<C.size();i++)
	{
		t+=C[i];
		C[i]=t%10;
		t/=10;
	}
	while(C.size()>1&&C.back()==0)
		C.pop_back();
	return C;
}
int main()
{
	cin>>a>>b;
	for(int i=a.size()-1;i>=0;i--)
		A.push_back(a[i]-''0'');
	for(int i=b.size()-1;i>=0;i--)
		B.push_back(b[i]-''0'');
	vector<int> C(A.size()+B.size()+5);
	C=mul(A,B);
	for(int i=C.size()-1;i>=0;i--)
		printf("%d",C[i]);
}
```
',
  '2022-08-20',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'files-structs-and-size-comparison',
  '文件、结构体定义及大小比较',
  'C++ 文件操作、结构体定义与大小比较笔记。',
  'development',
  '["C++"]',
  '****文件****

```scss
freopen("slyat.in","r",stdin);

freopen("slyar.out","w",stdout);

fclose(stdin); fclose(stdout);
```

****结构体****

定义结构体时同时定义变量

```csharp
struct student{
        string name；

        int chinese，math；

        Int total；

}a[100];
```

先定义结构体后定义变量

```csharp
struct student{
        string name；

        int chinese，math；

        Int total；

};

student a[100];
```

****结构体的比较****

```cobol
bool cmp(student x,student y)
{
	if(x.year==y.year)
	{
		if(x.mon==y.mon)
		{
			if(x.day==y.day)
				return x.num>y.num;
			return x.day<y.day;
		}
		return x.mon<y.mon;
	}
	return x.year<y.year;
}
sort(a+1,a+n+1,cmp);
```
',
  '2022-08-20',
  '2023-01-13',
  0,
  0,
  0
);

INSERT OR IGNORE INTO kb_notes (
  id, title, summary, category, tags, body, created_at, updated_at, draft, featured, strict
) VALUES (
  'scanf-and-printf',
  'scanf、printf 用法',
  'C/C++ 中 scanf 与 printf 的格式符及常见用法。',
  'development',
  '["C++"]',
  '**scanf用法**

一般调用格式：scanf( 格式控制符 ，地址列表 ）；

**格式符**

o 八进制整数

x 十六进制整数

c 单个字符

s 字符串

f 实数（小数或指数均可）

e 与f相同

**附加格式**

l 用于长整型（eg：%ld，%lo）或double型实数（eg: %lf)

h 用于短整型 （eg：%hd，%ho）

域宽 指定输入所占列宽

eg：

{

int a,b,c;

scanf("%4d%4d",&a,&b);

printf("a=%d,b=%d",a,b);

}

输入 1234567

输出 a=134，b=567

* 表示对应输入量不赋给变量

eg：

{

int a,b;

scanf("%d%*d%d",&a,&b);

printf("a=%d,b=%d",a,b);

}

输入 1 2 3

输出 a=1,b=3

****读字符****

while((st[n++]=getchar()!=’\n’); 将原文放在st中，读到空格结束

while(scanf(“%s”,&st)==1) 循环读入，读到读不到为止

**Printf用法**

printf(格式控制符，输出列表);

格式符同scanf

**d格式符**

%md 输出m位，不足补空格，大于m按实际位数输出

%-md 同上输出m位，左对齐输出

%ld

%mld

**f格式符**

%f

%m.nf总位数m位，有n位小数

%-m.nf 同上，左对齐

**s格式符**

%s

%ms m指定宽度，不足左补空格，大于按实际输出

%-md

%m.ns 输出占m个字符，字符数最多n个，左补空格

%-m.ns 同上，右补空格
',
  '2022-08-19',
  '2023-01-13',
  0,
  0,
  0
);
