import React from 'react';
import Toast from "../../../../Toast";
import classnames from "classnames";
import MultipleSearch from "../../../../MultipleSearch/components";

class CommitAt extends React.Component {

    constructor(props) {
        super(props);
        this.state ={
            showFlag:'hidden',
            searchOriginList : [],
            visible:false,
            comment:''
        }

        this.editor =  '';
        this.selectEmployee = [];
        this.insertText = '';
        this.isComEnd = false;

        this.onEnter = this.onEnter.bind(this);
        this.onCancel = this.onCancel.bind(this);
        this.onConfirm = this.onConfirm.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onCompositionEnd = this.onCompositionEnd.bind(this);
        this.onClick = this.onClick.bind(this);

    }
    componentDidMount() {
        const E = window.wangEditor;
        let editor = new E('#approval-editor');

        //菜单置空
        editor.config.menus = [];
        //创建
        editor.create();
        this.editor = editor;

        //修改默认的placeHolder
        let placeholder = document.getElementsByClassName('placeholder')[0];
        placeholder.innerHTML = '请输入评论（尝试@TA，TA将会在APP工作通知中收到消息）';

    }

    //键盘输入事件
    onKeyDown(e){
        //由于要通过异步访问事件，所以需要保留事件属性,参见react的合成属性
        e.persist();
        //获取当前选区所在的dom节点
        let currentSelection = this.editor.selection.getSelectionContainerElem().elems[0];
        //通过类名来判断是不是@人dom节点
        let className = currentSelection.getAttribute('class');
        if(className == 'at-text'){
            //如果是删除则删除整个@dom节点
            // 使用 e.key === 'Backspace' 会删除整个span标签
            // 使用 e.keyCode === '8' 会一个字的删除
            if(e.keyCode === '8' || e.key === 'Backspace'){
                //获取当前选区所在的dom节点的父节点
                let ele = currentSelection.parentNode;
                ele.removeChild(currentSelection);
            }
        }
        //只有有key的输入就设置中文输入标识为false
        this.isComEnd = false;
    }

    //实时设置输入的内容字数
    onKeyUp(){
        this.setState({
            comment:this.editor.txt.text()
        })
    }

    //中文输入完之后获取光标的位置
    onCompositionEnd(){
        this.selection = getSelection();
        this.range = this.selection.getRangeAt(0);
        //并设置中文输入标识
        this.isComEnd = true;
    }

    // 光标点击时需要重新获取光标的位置
    onClick(){
        let selection = getSelection();
        let range = selection.getRangeAt(0);
        if(this.range && this.range.startOffset !== range.startOffset){
            this.selection = selection;
            this.range = range;
        }
    }

    //点击选择@员工
    onEnter() {
        this.setState({
            visible: true
        })
    }

    //点击取消
    onCancel() {
        this.setState({
            visible: false
        })
    }

    //点击确定选择员工
    onConfirm(value){
        let insertNodes = '';
        value.forEach((item)=>{
            //@上限一百人
            if(this.selectEmployee.length > 100){
                Toast.error('最多@100个人',2000,undefined,false)
            }

            //过滤出是否已经选择过
            let isHave = this.selectEmployee.filter(obj => {
                return obj.id == item.id;
            })

            //如果有则不再继续向存@人数组中添加 但是输入框可以继续添加
            if(isHave.length == 0){
                //保存@的人
                this.selectEmployee.push(item);
            }
            //构造插入的节点
            //如果是中文输入则在光标位置插入
            if(this.isComEnd){
                let insertNode = document.createElement('span');
                insertNode.innerHTML = '@'+item.name;
                insertNode.className = 'at-text';
                let insertNode2 = document.createElement('span');
                insertNode2.innerHTML = '&nbsp;';

                this.range.insertNode(insertNode2);
                this.range.insertNode(insertNode);
                this.selection.collapseToEnd();

            }else{
                insertNodes += '<span class="at-text">@'+item.name +'</span><span>&nbsp;</span>';
            }

        })

        //否则使用此方法输入
        if(!this.isComEnd){
            this.editor.cmd.do('insertHTML',insertNodes);
        }

        //遍历插入的@人节点，设置颜色、不可编辑
        let atTexts = document.getElementsByClassName('at-text');
        for(let i=0; i<atTexts.length; i++){
            atTexts[i].style.color = '#2fd3a1';
            // //设置@人的节点不可编辑  在h5有很多弊端。。光标会定位不准确
            // atTexts[i].contentEditable = false;
        }
        //选择完之后要恢复标识
        this.isComEnd = false;
        this.onKeyUp();
    }

    //获取评论内容 父组件调用
    getCommentText(){
        //获取输入的内容
        let text = this.editor.txt.text();
        //实际@有效的员工
        let realEmployee = [];
        //获取到所有@的员工节点
        let atTexts = document.getElementsByClassName('at-text');

        //如果@之后又删除了或者对节点有操作，需要从已经存入了@人的变量中剔除
        for(let i=0; i<atTexts.length; i++){
            //获取节点的内容
            let atText = atTexts[i].innerHTML;
            for(let i = 0; i<this.selectEmployee.length;i++){
                let item = this.selectEmployee[i];
                //判断是否对@的人添加其他文字
                if(atText == '@'+item.name){
                    realEmployee.push(item);
                }
            }
        }

        //  把&nbsp;替换为空格
        let comment = text.replace(/&nbsp;/ig," ");
        //选择的员工id
        let atEmployeeIds = realEmployee.map(item => {
            return item.id;
        })
        return {
            comment,
            atEmployeeIds
        };
    }


    render() {
        const {visible,comment} = this.state;
        const {maxLength} = this.props;
        let valueLength = comment.replace(/&nbsp;/ig," ").length;

        return(
            <div>
                <div className="comment-at">
                    <div ref="editor" className="editor" id="approval-editor" onKeyDown={(e)=>{this.onKeyDown(e)}} onKeyUp={(e)=>{this.onKeyUp(e)}}  onCompositionEnd={this.onCompositionEnd} onClick={this.onClick} />
                    {
                        maxLength ?
                            <div className="count-wrap">
                            <span
                                className={classnames('count', 'count-num',
                                    {'green': valueLength > 0 && valueLength <= maxLength},
                                    {'red': valueLength > maxLength}
                                )}
                            >
                                {valueLength}
                            </span>/
                                <span className="count count-max">{maxLength}</span>
                            </div>
                            :
                            null
                    }
                </div>

                <MultipleSearch
                    searchType='employee'
                    visible={visible}
                    placeholderText=""
                    includeSelf={false}
                    includeOpenEmployee
                    onCancel={this.onCancel}
                    onConfirm={this.onConfirm}
                    isMulti="true"
                    multiArr=''
                >
                    <div>
                        <a className="at-select" onClick={this.onEnter}>@提醒谁看</a>
                    </div>
                </MultipleSearch>
            </div>
        )
    }
}

export  default CommitAt;

