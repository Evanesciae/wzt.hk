import {Marked} from 'marked';
import sanitize from 'sanitize-html';
import katex from 'katex';

export function studyMarkdown(input:string):string {
  const maths:string[]=[];
  const prefix=`WZTMATH${crypto.randomUUID().replaceAll('-','')}X`;
  const parser=new Marked({extensions:[{
    name:'studyMath',level:'inline',start:src=>src.indexOf('$'),
    tokenizer(src){const match=/^(\$\$|\$)([\s\S]+?)\1/.exec(src);if(match)return {type:'studyMath',raw:match[0],text:match[2],display:match[1]==='$$'};},
    renderer(token){const id=maths.length;maths.push(katex.renderToString(token.text,{displayMode:token.display,throwOnError:false,trust:false,strict:'ignore',maxExpand:1000,maxSize:20}));return `${prefix}${id}END`;},
  }]});
  const html=sanitize(parser.parse(input,{async:false}),{
    allowedTags:sanitize.defaults.allowedTags.filter(t=>t!=='img'),
    allowedAttributes:{a:['href','title','rel'],code:['class']},
    allowedSchemes:['https','http'],allowProtocolRelative:false,
    transformTags:{a:sanitize.simpleTransform('a',{rel:'noopener noreferrer nofollow'})},
  });
  return html.replace(new RegExp(`${prefix}(\\d+)END`,'g'),(_,i)=>maths[Number(i)]??'');
}
