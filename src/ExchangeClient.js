'use strict';


function NewExchangeClient( ServerUrl, ClientOptions )
{
	if ( !ClientOptions ) { ClientOptions = {}; }


	//---------------------------------------------------------------------
	var ThisSession = null;
	var ThisClerk = null;


	//---------------------------------------------------------------------
	class NetworkError extends Error
	{
		constructor( Response )
		{
			super( `Network error: [${Response.status}] ${Response.statusText}` );
			this.name = 'NetworkError';
			this.Response = Response;
			return;
		}
	}


	//---------------------------------------------------------------------
	class ApiError extends Error
	{
		constructor( ApiResponse )
		{
			super( ApiResponse.error );
			this.name = 'ApiError';
			this.ApiResponse = ApiResponse;
			return;
		}
	}


	//---------------------------------------------------------------------
	async function call_api( Command, Parameters, CallOptions = null )
	{
		if ( !CallOptions ) { CallOptions = {}; }

		try
		{
			var request_url = ServerUrl + Command;
			var command_log_header = `ExchangeApi`;

			var request_init = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify( Parameters ),
			};

			// Get the session token.
			if ( ThisSession && ThisSession.session_token )
			{
				request_init.headers.Authorization = `Bearer ${ThisSession.session_token}`;
			}
			else if ( typeof window !== 'undefined' ) 
			{
				if ( ThisClerk )
				{
					var session_token = null;
					if ( ThisClerk.session )
					{
						session_token = await ThisClerk.session.getToken();
					}
					if ( session_token )
					{
						request_init.headers.Authorization = `Bearer ${session_token}`;
					}
				}
			}

			// Get the session user.
			if ( ThisSession && ThisSession.User )
			{
				command_log_header += ` as (${ThisSession.User.user_name})`;
			}
			else
			{
				command_log_header += ` as (anonymous)`;
			}

			// Log requests.
			if ( ClientOptions.log_requests )
			{
				console.log( `${command_log_header} -->> Server [${Command}]`, Parameters );
			}

			// Request the response.
			var response = await fetch( request_url, request_init );

			// Decode the response.
			if ( !response )
			{
				throw new Error( `Received an empty response from the server.` );
			}
			else if ( !response.ok )
			{
				throw new NetworkError( response );
			}
			var api_response = await response.json();

			// Log responses.
			if ( ClientOptions.log_responses )
			{
				console.log( `${command_log_header} <<-- Server [${Command}]`, api_response );
			}

			// Handle API Errors.
			if ( api_response.error )
			{
				// throw new Error( api_response.error );
				throw new ApiError( api_response );
			}

			// Invoke the callbacks.
			if ( ClientOptions.GlobalCallback && ( typeof ClientOptions.GlobalCallback === 'function' ) ) 
			{
				await ClientOptions.GlobalCallback( null, api_response.result );
			}
			if ( CallOptions.Callback && ( typeof CallOptions.Callback === 'function' ) ) 
			{
				await CallOptions.Callback( null, api_response.result );
			}

			// Return the result.
			return api_response.result;

		}
		catch ( error )
		{
			var throw_error = null;

			// Process the error.
			var error_handled = false;
			if ( error instanceof NetworkError )
			{
				throw_error = new Error( `In command [${Command}]; ${error.message}` );
			}
			else if ( error instanceof ApiError )
			{
				throw_error = new Error( `In command [${Command}]; ${error.message}` );
			}
			else
			{
				var message = `In command [${Command}]; ${error.message}`;
				if ( error.cause && error.cause.code ) { message += ` [${error.cause.code}]`; }
				throw_error = new Error( message );
			}

			// Invoke the callbacks.
			if ( ClientOptions.GlobalCallback && ( typeof ClientOptions.GlobalCallback === 'function' ) ) 
			{
				await ClientOptions.GlobalCallback( throw_error.message, null );
				error_handled = true;
			}
			if ( CallOptions.Callback && ( typeof CallOptions.Callback === 'function' ) ) 
			{
				await CallOptions.Callback( throw_error.message, null );
				error_handled = true;
			}

			// Throw the error.
			if ( ClientOptions.throw_handled_errors || !error_handled )
			{
				throw throw_error;
			}
		}
		return;
	};


	//---------------------------------------------------------------------
	var ExchangeClient = {


		//=====================================================================
		//=====================================================================
		//
		//	Authenticate
		//
		//=====================================================================
		//=====================================================================


		//---------------------------------------------------------------------
		// For NodeJS Clients
		Authenticate:
			async function ( UserEmail, Password, CacheCredentials = true )
			{
				ThisSession = await call_api( '/Session/Signin',
					{
						email_address: UserEmail,
						password: Password
					}, null );
				if ( !ThisSession ) { return null; }
				return ThisSession.User;
			},


		//---------------------------------------------------------------------
		// For Browser Clients
		BrowserClerk:
			async function ( Clerk, CacheCredentials = true )
			{
				ThisClerk = Clerk;
				ThisSession = {};
				ThisSession.User = await call_api( '/User',
					{
					}, null );
				if ( !ThisSession.User ) { return null; }
				return ThisSession.User;
			},


		//=====================================================================
		//=====================================================================
		//
		//	Server Routes
		//
		//=====================================================================
		//=====================================================================


		Server: {

			//---------------------------------------------------------------------
			GetServerInfo: async function ( CallOptions = null )
			{
				return await call_api( '/Session/ServerInfo',
					{
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			GetServerError: async function ( CallOptions = null )
			{
				return await call_api( '/Session/ServerError',
					{
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			GetAssetType: async function ( AssetType, CallOptions = null )
			{
				return await call_api( '/AssetTypeSpecifications',
					{
						asset_type: AssetType,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			GetUser: async function ( CallOptions = null )
			{
				return await call_api( '/User',
					{
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			LookupUser: async function ( EmailAddress, CallOptions = null )
			{
				return await call_api( '/User/Lookup',
					{
						email_address: EmailAddress,
					}, CallOptions );
			},

		},


		//=====================================================================
		//=====================================================================
		//
		//	Account Routes
		//
		//=====================================================================
		//=====================================================================


		Accounts: {

			//---------------------------------------------------------------------
			List: async function ( CallOptions = null )
			{
				return await call_api( '/Accounts',
					{
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Get: async function ( AccountID, CallOptions = null )
			{
				return await call_api( '/Account',
					{
						account_id: AccountID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Create: async function ( CallOptions = null )
			{
				return await call_api( '/Account/Create',
					{
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Destroy: async function ( AccountID, CallOptions = null )
			{
				return await call_api( '/Account/Destroy',
					{
						account_id: AccountID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Rename: async function ( AccountID, AccountName, CallOptions = null )
			{
				return await call_api( '/Account/Rename',
					{
						account_id: AccountID,
						account_name: AccountName,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			GetAssets: async function ( AccountID, CallOptions = null )
			{
				return await call_api( '/Account/Assets',
					{
						account_id: AccountID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			GetAssetSummary: async function ( AccountID, ResolveFields, CallOptions = null )
			{
				return await call_api( '/Account/AssetSummary',
					{
						account_id: AccountID,
						ResolveFields: ResolveFields,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			GetAudits: async function ( AccountID, CallOptions = null )
			{
				return await call_api( '/Account/Audits',
					{
						account_id: AccountID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Funding: async function ( AccountID, FundingAction, FundingInfo, CallOptions = null )
			{
				var params = JSON.parse( JSON.stringify( FundingInfo ) );
				params.account_id = AccountID;
				params.funding_action = FundingAction;
				return await call_api( '/Account/Funding', params, CallOptions );
			},

			//---------------------------------------------------------------------
			TestDeposit: async function ( AccountID, AmountCents, CallOptions = null )
			{
				return await call_api( '/Account/Funding',
					{
						funding_action: 'deposit.direct',
						account_id: AccountID,
						amount_cents: AmountCents,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			TestWithdraw: async function ( AccountID, AmountCents, CallOptions = null )
			{
				return await call_api( '/Account/Funding',
					{
						funding_action: 'withdraw.direct',
						account_id: AccountID,
						amount_cents: AmountCents,
					}, CallOptions );
			},

		},


		//=====================================================================
		//=====================================================================
		//
		//	Permissions Routes
		//
		//=====================================================================
		//=====================================================================


		Permissions: {

			//---------------------------------------------------------------------
			List: async function ( AccountID, CallOptions = null )
			{
				return await call_api( '/Permissions',
					{
						account_id: AccountID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Set: async function ( AccountID, UserID, Permission, CallOptions = null )
			{
				return await call_api( '/SetPermission',
					{
						account_id: AccountID,
						user_id: UserID,
						permission: Permission,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Unset: async function ( AccountID, UserID, Permission, CallOptions = null )
			{
				return await call_api( '/UnsetPermission',
					{
						account_id: AccountID,
						user_id: UserID,
						permission: Permission,
					}, CallOptions );
			},

		},


		//=====================================================================
		//=====================================================================
		//
		//	Offerings Routes
		//
		//=====================================================================
		//=====================================================================


		Offerings: {

			//---------------------------------------------------------------------
			List: async function ( AccountID, CallOptions = null )
			{
				return await call_api( '/Offerings',
					{
						account_id: AccountID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Get: async function ( OfferingID, CallOptions = null )
			{
				return await call_api( '/Offering',
					{
						offering_id: OfferingID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Create: async function ( AccountID, AssetType, CallOptions = null )
			{
				return await call_api( '/Offering/Create',
					{
						account_id: AccountID,
						asset_type: AssetType,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Destroy: async function ( OfferingID, CallOptions = null )
			{
				return await call_api( '/Offering/Delete',
					{
						offering_id: OfferingID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Update: async function ( OfferingID, OfferingInfo, CallOptions = null )
			{
				return await call_api( '/Offering/Save',
					{
						offering_id: OfferingID,
						offering_name: OfferingInfo.offering_name,
						description: OfferingInfo.description,
						asset_info: OfferingInfo.asset_info,
						supplier_fee_rate: OfferingInfo.supplier_fee_rate,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Activate: async function ( OfferingID, CallOptions = null )
			{
				return await call_api( '/Offering/Activate',
					{
						offering_id: OfferingID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Pause: async function ( OfferingID, CallOptions = null )
			{
				return await call_api( '/Offering/Pause',
					{
						offering_id: OfferingID,
					}, CallOptions );
			},

		},


		//=====================================================================
		//=====================================================================
		//
		//	PublicOfferings Routes
		//
		//=====================================================================
		//=====================================================================


		PublicOfferings: {

			//---------------------------------------------------------------------
			List: async function ( CallOptions = null )
			{
				return await call_api( '/PublicOfferings',
					{
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Get: async function ( OfferingID, CallOptions = null )
			{
				return await call_api( '/PublicOffering',
					{
						offering_id: OfferingID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			GetMarket: async function ( OfferingID, CallOptions = null )
			{
				return await call_api( '/PublicOffering/Market',
					{
						offering_id: OfferingID,
					}, CallOptions );
			},

		},


		//=====================================================================
		//=====================================================================
		//
		//	Orders Routes
		//
		//=====================================================================
		//=====================================================================


		Orders: {

			//---------------------------------------------------------------------
			List: async function ( AccountID, IncludeClosed, CallOptions = null )
			{
				return await call_api( '/Orders',
					{
						account_id: AccountID,
						include_closed: IncludeClosed,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Get: async function ( OrderID, CallOptions = null )
			{
				return await call_api( '/Order',
					{
						order_id: OrderID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Create: async function ( AccountID, OfferingID, OrderInfo, CallOptions = null )
			{
				if ( !ThisSession || !ThisSession.User ) { throw new Error( `You must call Authenticate() or Connect() before using the Exchange Client.` ); }
				return await call_api( '/Order/Create',
					{
						user_id: ThisSession.User.user_id,
						account_id: AccountID,
						offering_id: OfferingID,
						order_type: OrderInfo.order_type,
						unit_count: OrderInfo.unit_count,
						unit_price: OrderInfo.unit_price,
						expiration: OrderInfo.expiration,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			Close: async function ( OrderID, CallOptions = null )
			{
				return await call_api( '/Order/Close',
					{
						order_id: OrderID,
					}, CallOptions );
			},

			//---------------------------------------------------------------------
			GetTransactions: async function ( OrderID, CallOptions = null )
			{
				return await call_api( '/Order/Transactions',
					{
						order_id: OrderID,
					}, CallOptions );
			},

		},


	};


	//---------------------------------------------------------------------
	return ExchangeClient;
}


//---------------------------------------------------------------------
if ( typeof module !== 'undefined' ) { module.exports = NewExchangeClient; }
if ( typeof window !== 'undefined' ) 
{
	if ( typeof window.SpiritEx === 'undefined' ) { window.SpiritEx = {}; }
	window.SpiritEx.NewExchangeClient = NewExchangeClient;
}

