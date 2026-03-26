import axios from 'axios'

export interface MycaCall {
    taskDesc: string
    // optionally add more stuff we want to pass to myca
}

export interface MycaResp {
    success: boolean
    url: string
    code: number

}

// TODO: maybe change url endpoint? mcp route name doesn't make sense
const MYCA_URL = "https://wymdcqx7mp.us-east-1.awsapprunner.com/mcp"

// agent invokes this function ... so it decides what to pass as arg
// should be strong definition of task to be completed
// just calls myca and returns the metadata needed
export default async function callMyca(callPayload: MycaCall): Promise<MycaResp>{

    try {
        // 1. call myca to get endpoint
        const response = await axios.post<MycaResp>(MYCA_URL, callPayload, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    // just return response data even if no one found
    // myca should describe if no agent found, not necessarily an error
    return response.data
 
    }

    // TODO: make codes make sense
    catch (error){
        console.error(error)
        return {success: false, url: "", code: 400}
    }

}