<template>
  <div>
    <div ref="editor" class="editor" id="approval-editor" @keydown="enterEv($event)" @click="handleClickMask"></div>
    <div class="at-someone" :style="{left:left+'px',top:top+'px',visibility:showFlag}">
      <div
        class="at-someone-box"
        ref="atSomeoneBox"
      >
        <xin-icon class="f_s16 icon-search" xin-type="search" />
        <span
          class="icon icon-close"
          @click.stop="resetStatus"
          v-show="searchKeyword.length !== 0"
        >
          <xin-icon class="f_s16" xin-type="close"/>
        </span>

        <input
          ref="searchInput"
          class="search-input"
          placeholder="请输入要搜索的员工的姓名或手机号"
          type="text"
          @input="handleSearchInput"
          @keydown="handleKeyDown"
          v-model.trim="searchKeyword"
        >
        <div class="search-content">
          <ul class="search-list-ul">
            <li
              v-show="!isSearching"
              v-if="searchOriginList != null && searchOriginList.length == 0"
              class="no-result"
            >
              <p>暂无搜索结果...</p>
            </li>
            <li v-show="isSearching" class="no-result">
              <p>正在努力加载...</p>
            </li>

            <template
              v-if="searchOriginList != null && searchOriginList.length != 0"
            >
              <li class="search-list-li clearfix"
                  v-for="(employee,index) in searchOriginList"
                  :key="index"
                  @click="selectPerson(employee)"
              >
                <span class="fl tit-head">{{employee.name[0]}}</span>
                <div class="fl tit-text">
                  <p :title="employee.name" v-html="employeeNameSpace(employee)"></p>
                  <p :title="parentEmployeeNames(employee)" class="department-name">{{parentEmployeeNames(employee)}}</p>
                  <p :title="employee.companyName" class="other-company-name" v-if="includeOpenScope && employee.isOpenScope"><span class="text">{{ employee.companyName }}</span></p>
                </div>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </div>
    <div class="comment-form-error" v-show="overWord">最多输入300个字符</div>
  </div>
</template>

<script lang="ts">
   import { Vue, Prop, Watch, Component } from 'vue-property-decorator';
   import { position } from 'caret-pos';
   import {ApproveListApi} from "@/module/approval/service/approve-list.service";

   @Component({
     name:'commentAt'
   })
   export default class CommentAt extends Vue {

     @Prop({ default:''})
     operationType!: string;

     @Prop({ default:[] })
     flowName!: Array<string>;

     //editor实例
     private editor: any;
     //搜索框定位
     private left: number = 0;
     private top: number = 0;
     //搜索框展示
     private showFlag: string = 'hidden';
     //是否正在搜索
     private isSearching: boolean = false;
     //是否能搜索
     private searchAjaxController: boolean = false;
     //搜索的关键词
     private searchKeyword: any = '';
     //搜索外部员工
     private includeOpenScope: boolean = true;
     //搜索出的员工列表
     private searchOriginList: Array<any> = [];
     //@的员工
     private selectEmployee: Array<any> = [];
     private excludeEmployeeIds: Array<any> = [];
     //是否选择了员工
     private isCheck: boolean = false;
     private wangEditorCopy:any = {};
     //输入是否超出限制长度
     private overWord: boolean = false;

     @Watch('showFlag')
     watchShowFlag(newVal: any, oldVal: any){
       if(newVal == 'visible' && oldVal == 'hidden') {
         this.isCheck = false
       }
       if(newVal == 'hidden' && oldVal == 'visible') {
         //如果没有选择的话则插入一个文本@
         setTimeout(()=>{
           if(!this.isCheck){
             this.editor.cmd.do('insertHTML','@')
           }
         },100)
       }
     }
     created(){
       const t = this;
       //进入时先备份一份数据，防止离职交接表单的wangEditor丢失
       this.wangEditorCopy = window.wangEditor;
       let editor_v4 = document.getElementById('importEditor');
       if(!editor_v4){
         //动态引入wangEditor
         let scriptDom: any = document.createElement("script");
         let approval = document.getElementById('approval');

         scriptDom.src = "//xxxxxx.com/plugins/wangEditor.min.js";
         scriptDom.id = 'importEditor';
         approval && approval.appendChild(scriptDom);

         scriptDom.onload = function() {
           const E = window.wangEditor;
           let editor = new E('#approval-editor')
           editor.config.onchange = (html: any) => {
             //判断输入内容是否超出限制长度
             let text = editor.txt.text().replace(/&nbsp;/ig," ");
             t.overWord = text.length > 300;
             t.$emit('update',text);
           }
           //菜单置空
           editor.config.menus = [];
           //创建
           editor.create();
           t.editor = editor;

           //editor
           let editorDom = document.getElementsByClassName('editor')[0] as HTMLElement;
           editorDom.style.minHeight = '150px';
           editorDom.style.marginBottom = '20px';
           //菜单
           let menu = document.getElementsByClassName('w-e-menu')[0] as HTMLElement;
           menu.style.display = 'none';
           let toolbar = document.getElementsByClassName('w-e-toolbar')[0] as HTMLElement;
           toolbar.style.border = 'none';
           //内容区
           let container = document.getElementsByClassName('w-e-text-container')[0] as HTMLElement;
           container.style.height = '150px';
           container.style.border = '1px dashed #DCDFE6';
           //修改默认的placeHolder
           let placeholder = document.getElementsByClassName('placeholder')[0] as HTMLElement;
           placeholder.innerHTML = '请输入评论（尝试@TA，TA将会在APP工作通知中收到消息）';
           placeholder.style.fontSize = '13px';
         };
       }
     }

     /**
      * @description keydown触发事件
      * @param e
      */
     private enterEv (e: any) {
       //由于编辑器不是textarea或者input，无法使用selectionStart获取到光标位置。
       //getSelection是另一种获取用户选择的文本范围或光标的当前位置的方法
       let selection = getSelection();
       //判断输入的是@符号
       //解决window中文输入兼容问题
       if ((e.key === '@' || e.code === 'Digit2') && e.shiftKey) {
         // 兼容
         e.preventDefault ? e.preventDefault() : e.returnValue = false;
         //getRangeAt()用来获取一个包含当前选区内容的区域对象
         this.position = {
           range: selection.getRangeAt(0), //获取选区区域的引用
           selection: selection
         }

         //根据输入@的位置定位下拉框的位置
         this.getPosition();
         //展示下拉框
         this.showFlag = 'visible';
         setTimeout(()=>{
           //下拉框搜索框自动获取焦点
           this.$nextTick(()=>{
             const searchInputRef = this.$refs.searchInput as HTMLInputElement;
             searchInputRef.focus();
           })
         },200)
       }
       //初始时，编辑器中元素是<p><br></p>
       let brDom = this.editor.$textElem.elems[0].firstChild.firstChild;
       if (brDom && brDom.tagName === "BR") {
         //移除br
         this.editor.$textElem.elems[0].firstChild.removeChild(brDom);
       }
     }

     /**
      * @description 获取@位置
      */
     private getPosition () {
       this.showFlag = 'visible';
       //获取编辑器节点
       const ele = this.editor.$textElem.elems[0];
       //获取位置
       const pos = position(ele);
       //离职审批的通过评论@位置不同
       if(this.flowName[0] == 'dismiss' && this.operationType == 'approve'){
         //定位下拉框位置
         this.left = pos.left+60;
         this.top = pos.top+150;
       }else{
         //定位下拉框位置
         this.left = pos.left+50;
         this.top = pos.top+100;
       }
     }


     /**
      * @description 输入搜索员工
      * @param e
      */
     private handleSearchInput(e: any){
       //搜索关键词
       this.searchKeyword = e.target.value;
       //搜索控制器，为了防止点击差号关闭了搜索之后ajax再返回
       this.searchAjaxController = true;
       //正在搜索
       this.isSearching = true;
       let param = {};

       if(this.searchKeyword == ''){
         this.resetStatus();
         return;
       }

       param = {
         keyword: this.searchKeyword,
         type: 1,
         excludeEmployeeIds: this.excludeEmployeeIds.join(','),
         includeOpenScope: this.includeOpenScope,
         _: new Date().getTime(),
       }

       ApproveListApi.handleSearchEmployee(param).then((res: any) => {
         const result = res.data;
         const { keyword, employees, openScopeEmployees } = result;
         this.isSearching = false;
         if (keyword) {
           if (this.searchKeyword != result.keyword) {
             return;
           }
         }

         if(employees){
           openScopeEmployees.forEach( (item: any) => {
             item.isOpenScope = true;
           })
           this.searchOriginList = [].concat(employees, openScopeEmployees)
         }else{
           this.searchOriginList = result;
         }
       })
     }

     /**
      * 禁用回车提交事件
      */
     private handleKeyDown(e: any){
       if(e.key == 'enter'){
         e.preventDefault ? e.preventDefault() : e.returnValue = false;
       }
     }

     /**
      * @description 选人
      * @param item
      */
     private selectPerson (item: any) {
       this.showFlag = 'hidden';
       this.resetStatus();
       //@上限一百人
       if(this.selectEmployee.length > 100){
         this.$message.error('最多@100个人');
         return;
       }

       this.isCheck = true;
       //过滤出是否已经选择过
       let isHave = this.selectEmployee.filter((obj: any) => {
         return obj.employeeId == item.employeeId;
       })

       //如果有则不再继续向存@人数组中添加 但是输入框可以继续添加
       if(isHave.length == 0){
         //保存@的人
         this.selectEmployee.push(item);
       }

       //插入@人元素
       const { name,employee_id: id } = item;
       //获取选区对象
       let selection = this.position.selection;
       let range = this.position.range;
       // 生成需要显示的内容，包括一个 span 和一个空格。
       let spanNode1 = document.createElement('span');
       let spanNode2 = document.createElement('span');
       spanNode1.className = 'at-text';
       spanNode1.style.color = '#2fd3a1';
       spanNode1.innerHTML = '@' + name;
       spanNode1.dataset.id = id;
       //  设置@人的节点不可编辑
       spanNode1.contentEditable = 'false';
       spanNode2.innerHTML = '&nbsp';

       // 将生成内容打包放在 Fragment 中，并获取生成内容的最后一个节点，也就是空格。
       //创建一个新的空白的文档片段
       let frag = document.createDocumentFragment(), node,lastNode;
       frag.appendChild(spanNode1);
       node = spanNode2.firstChild;
       if(node) {
         lastNode = frag.appendChild(node);
       }
       // 将 Fragment 中的内容放入 range 中，并将光标放在空格之后。
       range.insertNode(frag);
       selection.collapse(lastNode, 1);

       //将当前的选区折叠到最末尾的一个点
       selection.collapseToEnd();

     }

     //重置状态
     private resetStatus(){
       this.searchKeyword = '';
       this.isSearching = false;
       this.searchAjaxController = false;
       //清空员工列表
       this.searchOriginList = [];
     }

     //遮罩  点击其他区域关闭下拉框
     private handleClickMask(){
       this.resetStatus();
       this.showFlag = 'hidden';
       this.isCheck = false;
     }

     //搜索员工显示的信息
     private employeeNameSpace(employee: any){
       let name = employee.name
       let mobile = employee.mobile;
       let highlightEmployeeName = this.getHighlightName(this.searchKeyword, name);
       let highlightMobile = this.getHighlightName(this.searchKeyword, mobile);
       let title = employee.jobName ? `- ${employee.jobName}` : '';
       return `${highlightEmployeeName}${title}-${highlightMobile}`;
     }

     //高亮名称
     private getHighlightName(keyword: any,name: any){
       let reg = new RegExp(keyword,'g');
       return name.replace(reg, "<span style='color: #64b734'>" + keyword + "</span>");
     }

     //员工的父级信息
     private parentEmployeeNames(employee: any){
       let depStr = '';
       let statusStr = employee.statusDesc ? employee.statusDesc : '';
       if(statusStr === null || statusStr == '' || !statusStr){
         return employee.parentDepartmentNames ? employee.parentDepartmentNames : '待分配...';
       }
       depStr = employee.departmentName ? employee.departmentName : '待分配...';
       return `${depStr} - ${statusStr}`;
     }

     //获取评论内容 父组件调用
     public getEmployeeIds(){
       let text = this.editor.txt.text();
       //如果@之后又删除了，需要从已经存入了@人的变量中剔除
       for(let i = 0; i< this.selectEmployee.length;i++){
         let item = this.selectEmployee[i];
         if(text.indexOf( `@${item.name}`) == -1){
           this.selectEmployee.splice(i,1);
           i--;
         }
       }
       //选择的员工id
       return this.selectEmployee.map((item:any) => {
         return item.employeeId;
       })
     }

     //销毁编辑器
     beforeDestroy() {
       if(this.editor){
         this.editor.destroy();
         this.editor = null;
       }
     }

     destroyed(){
       //由于离职交接页使用的wangEditor版本低，两者冲突，所以销毁时需要移除wangEditor的引入以及全局变量置空
       let approval = document.getElementById('approval') as HTMLElement;
       let script = document.getElementById('importEditor') as HTMLElement;
       if(script){
         approval.removeChild(script);
       }
       //离开时，把备份数据还原而不是置为null，防止离职交接表单用的缓存导致无wangEditor
       window.wangEditor = this.wangEditorCopy;
     }


   }
</script>

<style lang="scss">
  .at-someone{
    position: absolute;
    left: 0;
    z-index: 10001;
    box-shadow: 1px 0px 2px $lineBorderColor;
    border: 1px solid $lineBorderColor;
    box-sizing: border-box;
    border-radius: 4px;
    background: $white;
    height: auto;

    .at-someone-box {
      width: 320px;
      box-shadow: 0 0 3px #ccc;
      background: $white;
      box-sizing: border-box;

      .search-input {
        display: block;
        position: relative;
        top: 0;
        left: 0;
        width: 100%;
        outline: none;
        height: 40px;
        border: none;
        border-bottom: 1px solid #eeeeee;
        color: $baseTextColor;
        font-size: 14px;
        box-sizing: border-box;
        text-indent: 38px;
      }

      .icon-search {
        position: absolute;
        top: 10px;
        left: 15px;
        z-index: 999;
        color: #d5d5d5;
        font-size: 18px;
      }

      .icon-close {
        position: absolute;
        top: 5px;
        right: 7px;
        z-index: 999;
        color: #d5d5d5;
        font-size: 18px;
        cursor: pointer;
      }

      .search-content{
        min-height: 144px;
        max-height: 240px;
        overflow-y: auto;
        overflow-x: hidden;

        .search-list-ul{
          padding-top: 6px;
          padding-bottom: 10px;
          width: 100%;
          .search-list-li{
            cursor: pointer;
            background-color: $white;
            width: 100%;
            height: auto;
            border-radius: inherit;
            padding: 0;
            color: $baseTextColor;
            .tit-head {
              display: inline-block;
              width: 36px;
              height: 36px;
              line-height: 36px;
              color: $white;
              font-size: 16px;
              text-align: center;
              border-radius: 40px;
              margin: 6px 10px;
              padding: 0px;
              background-color:#2fd3a1;
            }
            .tit-text {
              width: 180px;
              height: auto;
              p {
                float: left;
                padding: 0;
                width: 170px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 12px;
                line-height: 18px;
                height: 18px;
                text-align: left;
                border: none;
              }
              p:first-child {
                margin-top: 6px;
              }
              p:last-child {
                color: $tipTextColor;
              }
              .other-company-name{
                .text{
                  color: #26a69a!important;
                }
              }
            }
          }

          .no-result{
            color: $tipTextColor;
            font-size: 14px;
            text-align: center;
            margin: auto;
            display: block;
            font-style: normal;
          }

        }
      }
    }

    .at-someone-mask {
      position: fixed;
      left: 0px;
      top: 0px;
      width: 100%;
      height: 100%;
      z-index: 10000;
    }
  }
  .comment-form-error{
    color: #ff4949;
    font-size: 12px;
    line-height: 1;
    padding-top: 4px;
    position: absolute;
    top: 100%;
    left: 0;
  }
</style>
