
// module "chess" {
//     function create() : GameClient
    
//     class GameClient {
//         on(event: string, callback: Function) : void
//         move(algebraicMove: string) : MoveResponse

//         notatedMoves: Record<string, MoveResponseMoveSquare>
//         isCheck: boolean
//         isCheckmate: boolean
//         isRepetition: boolean
//         isStalemate: boolean
//         PGN: boolean
//     }


    
//     // MOVE
//     interface MoveResponseMoveSquareSide {
//         name: string
//     }

//     interface MoveResponseMoveSquarePiece {
//         side: MoveResponseMoveSquareSide
//         type: string
//         notation: string
//     }

//     interface MoveResponseMoveSquare {
//         file: string
//         rank: number
//         piece?: MoveResponseMoveSquarePiece
//     }

//     interface MoveResponseMove {
//         capturedPiece: any
//         castle: boolean
//         enPassant: boolean
//         postSquare: MoveResponseMoveSquare
//         prevSquare: MoveResponseMoveSquare
//     }

//     interface MoveResponse {
//         move: MoveResponseMove
//         undo: () => void
//     }
//     // END MOVE
    
//     enum GameClientEvent {
//         Check = 'check'
//     }
// };