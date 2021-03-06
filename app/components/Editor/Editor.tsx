import * as React from 'react';
import { ChangeEvent, useEffect, useReducer } from 'react';
import { Drawer, Icon, Input } from 'antd';
import {
  actions,
  setData,
  setMetadata,
  setMetadataVisibilty,
  setProtoVisibility,
  setUrl,
} from './actions';
import AceEditor from 'react-ace';
import { Response } from './Response';
import { Metadata } from './Metadata';
import { Controls } from './Controls';
import { Request } from './Request';
import { GRPCRequest, ProtoInfo } from '../../behaviour';
import { getInteractive, getUrl, storeUrl } from '../../storage';

import 'brace/theme/textmate';
import 'brace/mode/json';
import 'brace/mode/protobuf';
import { Options } from './Options';
import { RequestType } from './RequestType';

export interface EditorAction {
  [key: string]: any

  type: string
}

export interface EditorState {
  url: string
  data: string
  loading: boolean
  output: string
  call?: GRPCRequest
  metadataOpened: boolean
  protoViewVisible: boolean
  metadata: string
  requestStreamData: string[]
  responseStreamData: string[]
  interactive: boolean
  streamCommitted: boolean
}

export interface InitialRequest {
  url: string
  inputs: string
  metadata: string
  interactive: boolean
}

export interface EditorProps {
  protoInfo?: ProtoInfo
  onRequestChange?: (url: string, inputs: string, metadata: string, interactive: boolean) => void
  initialRequest?: InitialRequest
}

const INITIAL_STATE: EditorState = {
  url: "0.0.0.0:3009",
  data: "",
  requestStreamData: [],
  responseStreamData: [],
  interactive: false,
  loading: false,
  output: "",
  call: undefined,
  metadataOpened: false,
  protoViewVisible: false,
  streamCommitted: false,
  metadata: "",
};

/**
 * Reducer
 * @param state
 * @param action
 */
const reducer = (state: EditorState, action: EditorAction) => {
  switch (action.type) {

    case actions.SET_DATA:
      return { ...state, data: action.data };

    case actions.SET_URL:
      return { ...state, url: action.value };

    case actions.SET_IS_LOADING:
      return { ...state, loading: action.isLoading };

    case actions.SET_OUTPUT:
      return { ...state, output: action.output };

    case actions.SET_CALL:
      return { ...state, call: action.call };

    case actions.SET_METADATA_VISIBILITY:
      return { ...state, metadataOpened: action.visible };

    case actions.SET_METADATA:
      return { ...state, metadata: action.metadata };

    case actions.SET_PROTO_VISIBILITY:
      return { ...state, protoViewVisible: action.visible };

    case actions.SET_INTERACTIVE:
      return { ...state, interactive: action.interactive };

    case actions.SET_REQUEST_STREAM_DATA:
      return { ...state, requestStreamData: action.requestData };

    case actions.SET_RESPONSE_STREAM_DATA:
      return { ...state, responseStreamData: action.responseData };

    case actions.ADD_RESPONSE_STREAM_DATA:
      return { ...state, responseStreamData: [...state.responseStreamData, action.responseData] };

    case actions.SET_STREAM_COMMITTED:
      return { ...state, streamCommitted: action.committed };
    default:
      return state
  }
};

export function Editor({ protoInfo, initialRequest, onRequestChange }: EditorProps) {
  const [state, dispatch] = useReducer<EditorState, EditorAction>(reducer, {
    ...INITIAL_STATE,
    url: (initialRequest && initialRequest.url) || getUrl() || INITIAL_STATE.url,
    interactive: (initialRequest && initialRequest.interactive) || getInteractive() || INITIAL_STATE.interactive,
  });

  useEffect(() => {
    if (protoInfo && !initialRequest) {
      try {
        const { plain } = protoInfo.service.methodsMocks[protoInfo.methodName]();
        dispatch(setData(JSON.stringify(plain, null, 2)));
      } catch (e) {
        console.error(e);
        dispatch(setData(JSON.stringify({
          "error": "Error parsing the request message, please report the problem sharing the offending protofile"
        }, null, 2)));
      }
    }

    if (initialRequest) {
      dispatch(setData(initialRequest.inputs));
      dispatch(setMetadata(initialRequest.metadata));
    }
  }, []);

  return (
    <div style={styles.tabContainer}>
      <div style={styles.inputContainer}>
        <div style={{ width: "50%" }}>
          <Input
            className="server-url"
            addonAfter={(
              <div style={{display: "flex", alignItems: "center", width: "125px"}}>
                {state.loading ? <Icon type="loading"/> : <Icon type="database"/>}
                <RequestType protoInfo={protoInfo} />
              </div>
            )}
            defaultValue={state.url}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              dispatch(setUrl(e.target.value));
              storeUrl(e.target.value);
              onRequestChange && onRequestChange(e.target.value, state.data, state.metadata, state.interactive);
            }}/>
        </div>

        {protoInfo && (
          <Options
            protoInfo={protoInfo}
            dispatch={dispatch}
            interactiveChecked={state.interactive}
            onInteractiveChange={(checked) => {
              onRequestChange && onRequestChange(state.url, state.data, state.metadata, checked);
            }}
          />
        )}
      </div>

      <div style={styles.playIconContainer}>
        <Controls
          dispatch={dispatch}
          state={state}
          protoInfo={protoInfo}
        />
      </div>

      <div style={styles.editorContainer}>
        <Request
          data={state.data}
          streamData={state.requestStreamData}
          onChangeData={(value) => {
            dispatch(setData(value));
            onRequestChange && onRequestChange(state.url, value, state.metadata, state.interactive);
          }}
        />

        <div style={styles.responseContainer}>
          <Response
            streamResponse={state.responseStreamData}
            output={state.output}
          />
        </div>
      </div>

      <Metadata
        onClickMetadata={() => {
          dispatch(setMetadataVisibilty(!state.metadataOpened));
        }}
        onMetadataChange={(value) => {
          dispatch(setMetadata(value));
          onRequestChange && onRequestChange(state.url, state.data, value, state.interactive);
        }}
        value={state.metadata}
        visibile={state.metadataOpened}
      />

      {protoInfo && (
        <Drawer
          title={protoInfo.service.proto.fileName.split('/').pop()}
          placement={"right"}
          width={"50%"}
          closable={false}
          onClose={() => dispatch(setProtoVisibility(false))}
          visible={state.protoViewVisible}
        >
          <AceEditor
            style={{ marginTop: "10px", background: "#fff" }}
            width={"100%"}
            height={"calc(100vh - 115px)"}
            mode="protobuf"
            theme="textmate"
            name="output"
            fontSize={13}
            showPrintMargin={false}
            wrapEnabled

            showGutter={false}
            readOnly
            highlightActiveLine={false}
            value={protoInfo.service.proto.protoText}
            onLoad={(editor: any) => {
              editor.renderer.$cursorLayer.element.style.display = "none";
              editor.gotoLine(0, 0, true);
            }}
            setOptions={{
              useWorker: true,
              showLineNumbers: false,
              highlightGutterLine: false,
              fixedWidthGutter: true,
              tabSize: 1,
            }}
          />
        </Drawer>
      )}
    </div>
  )
};

const styles = {
  tabContainer: {
    width: "100%",
    height: "100%",
  },
  editorContainer: {
    display: "flex",
    height: "100%",
    borderLeft: "1px solid rgba(0, 21, 41, 0.18)",
    background: "#fff"
  },
  responseContainer: {
    background: "white",
    width: "50%",
    borderLeft: "1px solid #eee",
    borderRight: "1px solid rgba(0, 21, 41, 0.18)",
    overflow: "auto"
  },
  playIconContainer: {
    position: "absolute" as "absolute",
    zIndex: 10,
    left: "50%",
    marginLeft: "-25px",
    top: "50%",
  },
  inputContainer: {
    display: "flex",
    justifyContent: "space-between",
    border: "1px solid rgba(0, 21, 41, 0.18)",
    borderBottom: "1px solid #eee",
    background: "#fafafa",
    padding: "15px",
    boxShadow: "2px 0px 4px 0px rgba(0,0,0,0.20)",
  },
};