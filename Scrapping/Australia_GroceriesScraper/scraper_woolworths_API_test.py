#### NOTE: This is a test file for the Woolworths API scraper. It is not intended to be run as a standalone script. ####
# I’ve been pulling product data via the Woolworths API, but CAPTCHAs keep blocking me. 
# Thinking we could throw in some rotating proxies and mix up the User-Agent headers so it looks like normal browser traffic.




# import requests

# url = "https://www.woolworths.com.au/apis/ui/browse/category"

# headers = {
#     "authority": "www.woolworths.com.au",
#     "method": "POST",
#     "path": "/apis/ui/browse/category",
#     "scheme": "https",
#     "accept": "application/json, text/plain, */*",
#     "accept-encoding": "gzip, deflate, br, zstd",
#     "accept-language": "en-US,en;q=0.9",
#     "content-type": "application/json",
#     # "cookie": "AKA_A2=A; bff_region=syd2; akaalb_woolworths.com.au=~op=www_woolworths_com_au_ZoneA:PROD-ZoneA|www_woolworths_com_au_BFF_SYD_Launch:WOW-BFF-SYD2|~rv=70~m=PROD-ZoneA:0|WOW-BFF-SYD2:0|~os=43eb3391333cc20efbd7f812851447e6~id=1d00acf522cd2e1e91afb769b7f64280; rxVisitor=17433052223348HERN9TUPI835GHI58KJ8O1D5VE19E99; ai_user=vdu8ACdQdvcut5ilzhJbuj|2025-03-30T03:27:02.399Z; at_check=true; AMCVS_4353388057AC8D357F000101%40AdobeOrg=1; AMCV_4353388057AC8D357F000101%40AdobeOrg=179643557%7CMCIDTS%7C20178%7CMCMID%7C84095666570811400700563380430641099406%7CMCAAMLH-1743910022%7C8%7CMCAAMB-1743910022%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1743312422s%7CNONE%7CvVersion%7C5.5.0; INGRESSCOOKIE=1743305224.48.70.566917|37206e05370eb151ee9f1b6a1c80a538; w-rctx=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NDMzMDUyMjMsImV4cCI6MTc0MzMwODgyMywiaWF0IjoxNzQzMzA1MjIzLCJpc3MiOiJXb29sd29ydGhzIiwiYXVkIjoid3d3Lndvb2x3b3J0aHMuY29tLmF1Iiwic2lkIjoiMCIsInVpZCI6ImRhMTJkYTMxLWNmM2YtNGY0NC05ZDU4LWQ1NTc2NzRjMjlkNCIsIm1haWQiOiIwIiwiYXV0IjoiU2hvcHBlciIsImF1YiI6IjAiLCJhdWJhIjoiMCIsIm1mYSI6IjEifQ.ljN5RDkdumvgJLxM_tqepDgc7158STKpVZvsg_svUTAw3V8o4kK55doXuY7QuMViR3e7iidYvmbMaHCUlKcsQbEicj1p2LDnaMo1Gw13kVC7-IWDCwst3sCeAsf8iTR5nBeKbdyz_ZeMZpU2TzyLDNbBHGYQfqVXmCRpm7htZPh9DlQlPM8rHpKMka6-bh6qc74BEsvbafTQ5GVGxlEHoWGs0s0kyciFXaRIUCYY9AWG4o1n8rA96u3OLIH-X-mFJcf_feOZZJfC2LKWv5wvWht6sgn9OYXH0411latAROvWdqRG3bpmDQOoPEUmwr9sxyeIDrC4ATrwJDELXt9XKw; wow-auth-token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NDMzMDUyMjMsImV4cCI6MTc0MzMwODgyMywiaWF0IjoxNzQzMzA1MjIzLCJpc3MiOiJXb29sd29ydGhzIiwiYXVkIjoid3d3Lndvb2x3b3J0aHMuY29tLmF1Iiwic2lkIjoiMCIsInVpZCI6ImRhMTJkYTMxLWNmM2YtNGY0NC05ZDU4LWQ1NTc2NzRjMjlkNCIsIm1haWQiOiIwIiwiYXV0IjoiU2hvcHBlciIsImF1YiI6IjAiLCJhdWJhIjoiMCIsIm1mYSI6IjEifQ.ljN5RDkdumvgJLxM_tqepDgc7158STKpVZvsg_svUTAw3V8o4kK55doXuY7QuMViR3e7iidYvmbMaHCUlKcsQbEicj1p2LDnaMo1Gw13kVC7-IWDCwst3sCeAsf8iTR5nBeKbdyz_ZeMZpU2TzyLDNbBHGYQfqVXmCRpm7htZPh9DlQlPM8rHpKMka6-bh6qc74BEsvbafTQ5GVGxlEHoWGs0s0kyciFXaRIUCYY9AWG4o1n8rA96u3OLIH-X-mFJcf_feOZZJfC2LKWv5wvWht6sgn9OYXH0411latAROvWdqRG3bpmDQOoPEUmwr9sxyeIDrC4ATrwJDELXt9XKw; prodwow-auth-token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NDMzMDUyMjMsImV4cCI6MTc0MzMwODgyMywiaWF0IjoxNzQzMzA1MjIzLCJpc3MiOiJXb29sd29ydGhzIiwiYXVkIjoid3d3Lndvb2x3b3J0aHMuY29tLmF1Iiwic2lkIjoiMCIsInVpZCI6ImRhMTJkYTMxLWNmM2YtNGY0NC05ZDU4LWQ1NTc2NzRjMjlkNCIsIm1haWQiOiIwIiwiYXV0IjoiU2hvcHBlciIsImF1YiI6IjAiLCJhdWJhIjoiMCIsIm1mYSI6IjEifQ.ljN5RDkdumvgJLxM_tqepDgc7158STKpVZvsg_svUTAw3V8o4kK55doXuY7QuMViR3e7iidYvmbMaHCUlKcsQbEicj1p2LDnaMo1Gw13kVC7-IWDCwst3sCeAsf8iTR5nBeKbdyz_ZeMZpU2TzyLDNbBHGYQfqVXmCRpm7htZPh9DlQlPM8rHpKMka6-bh6qc74BEsvbafTQ5GVGxlEHoWGs0s0kyciFXaRIUCYY9AWG4o1n8rA96u3OLIH-X-mFJcf_feOZZJfC2LKWv5wvWht6sgn9OYXH0411latAROvWdqRG3bpmDQOoPEUmwr9sxyeIDrC4ATrwJDELXt9XKw; ak_bmsc=0331CC338D8BFF051E7F931C1EF2CCE5~000000000000000000000000000000~YAAQHAUgF8GUC82VAQAA57MW5RsopBxFrOKsqNXb8TjOQlPrLmEnWztrU3j5co5q3JtupTUskGqIqysFNAAK8VdQ6Bj/R9U1sk+BXySRtXDa0l1NIMH8cny1SpGO8XZ6M9Ur4fDMxJkuIM0syXGMMglQzJ18wikmb2c8I+37U4rrvULO7XcdB7xm7PjIWwvpHxWiiy+FMC+NMq+I31WFBdxCLZI6uqgcfXvdUx54JqEvKBueLg4yL6TOXiBI7Im1QEt5HTDcFIxWlphZZTdDwzEvJk5UM1zwq6Zy/EMd/xsbAzJDfzSI39Hbi1exqjlQEgmTmUQjY7rz3u3t2P8LSg9OBi7oTNpUYNgtF5ciMXiwrs6rz0GBaV6MyvUqcgoccv3QH00AYyjUPRockzJY75dzdHYshOsToPZuxerXW/C+q11UX9Wr0jrRgQy38RUunr7DHXWoEMXHHQ66Q9HJrUCVLMU=; dtCookie=v_4_srv_2_sn_254505K44I0TE5OR8B4S0D6TVF12P78F_app-3Af908d76079915f06_1_ol_0_perc_100000_mul_1_rcs-3Acss_0; fullstoryEnabled=false; s_cc=true; aam_uuid=83642343197065407300537886695449942866; _fbp=fb.2.1743305227771.756607195338107150; IR_gbd=woolworths.com.au; _tt_enable_cookie=1; _ttp=01JQJHDFPVF9V4PFZZ4VKF5BXW_.tt.2; IR_PI=dc91322f-0d16-11f0-a459-29eebf7ab277%7C1743305227854; _scid=zNHLdO3AWXh0e10TjVEvrLfmh_HfFGxv; _gcl_au=1.1.2544012.1743305229; _gid=GA1.3.2031543988.1743305229; _ScCbts=%5B%5D; _sctr=1%7C1743253200000; kampyle_userid=9b41-a08c-39d8-d4bb-67d8-4889-13df-fd03; _gcl_gs=2.1.k1$i1743305755$u153838014; _gac_UA-38610140-9=1.1743305762.EAIaIQobChMI6Y7ugu6wjAMV_FwPAh2OqDVtEAAYASAAEgLEKPD_BwE; _gat_gtag_UA_38610140_9=1; _scid_r=2FHLdO3AWXh0e10TjVEvrLfmh_HfFGxvSEk87g; _ga=GA1.3.1845765418.1743305228; __gads=ID=541eeb176e71710b:T=1743305393:RT=1743305777:S=ALNI_MZ6JgGv88hh8ZnF3Fdg1F7W3tB5bw; __gpi=UID=0000107fd491bbd1:T=1743305393:RT=1743305777:S=ALNI_MZb2yy6YOLSJWUDZeEcxDh9apC4vQ; __eoi=ID=2eb813759ff37da5:T=1743305393:RT=1743305777:S=AA-AfjbS2Tf5DQCRj8KeXEuyDTE0; _gcl_aw=GCL.1743305791.EAIaIQobChMI6Y7ugu6wjAMV_FwPAh2OqDVtEAAYASAAEgLEKPD_BwE; _gcl_dc=GCL.1743305791.EAIaIQobChMI6Y7ugu6wjAMV_FwPAh2OqDVtEAAYASAAEgLEKPD_BwE; IR_7464=1743305761993%7Cc-17876%7C1743305761993%7C%7C; kampyleUserSession=1743305792877; kampyleUserSessionsCount=2; kampyleSessionPageCounter=1; kampyleUserPercentile=13.239634118142396; bm_sz=251D4A191211452D90207DEAA33DAB51~YAAQkgUgF4T1PsuVAQAABncf5Rux1LO7yDqO+B9ymzIV2LLODtlvWhCHrVCT8OxR283WLjXRf3EEQUq32gRc6FVoJco3PtrwgmvOdhTB2sSmi+oZ1pu0MrCcpODlftxiKAmbzci84mXWAZ+sVuPA0+42vlb8aYB0fI40coBoxyEAOoGUDQcKHkUluJS46nfZv/Zxhbaygj3G2WuWEtd1vXM+ANCfg8KatLNdmM+Ge0tXih4kYssyhAzLmGur6cZFU6A6Ysw9TGnGmE2dWB2CvttAGEAcAVJMz1Th9UGsDXE29kV9pBRbxdrrKO+oqTxKn6EJ3eByUDI/kkPiUpIO2GJVluO7fFHucjsyRJNX8tCy/uLjTXXd/hQ+sCpYiTHZfdYWVS9C7WsI11M4v/Uharplzjwz+uCe5WRlBMYNQ4SvPsoVfqtvVsMoNlPVn1uVcaLVkZG3cOUrnx2vI+FhIvD0Kxro9QyhnVeDnGiwq1qws73UbYaGZukUNEBy14E=~3684661~3223605; _ga_YBVRJYN9JL=GS1.1.1743305228.1.1.1743305798.23.0.0; dtSa=-; mbox=session#b6ba81cb408147e6a97caf15377b6d75#1743307659|PC#b6ba81cb408147e6a97caf15377b6d75.36_0#1806550593; RT="z=1&dm=www.woolworths.com.au&si=e884419f-e6ca-4db3-9452-89543921b967&ss=m8v2x0m1&sl=2&tt=3sf&obo=1&rl=1"; _abck=86437FCB0067DB69B1A4FF803545BFA5~0~YAAQkgUgF6f1PsuVAQAA5Hgf5Q3PlEihv2zZduR1kQ8pAOioZqtWBMiOhfnF7qjJHFADWTxqZEE7IerTq6Qk8/r5e+c5k6CJm0TfOOOSfKvyJiXr/xgIrdp/znZXl5X5gQBX7w1fQRXdjCI6z1EX3vO3IJVdkRzebp4xnRuzGnWem2MC5eVHRL7/s1XU2oKvrcv4jbXaJShYlO7SUTi02o2dj2rHR6V2ZM096e9h+4kLmngDYqy3LETE36MyTH5smZ62OFuzGy8F2ClW5DlWlXXxoyqvJIU2LIsqARLlqbPGFtRYTBHWwpajQ18nHzjhxn0nFMCUDIaAOvcQ3b+48Fa2yYM0kI8vbdyT2hJsH+yDfaMI3zThqni5Ll7+uyFaMcW7Ll/Pl2TELOHm5pNX2fpjDTytox2l9aS5NM4ImSDD0z3FBrblL7DvMt9VhrtJjv0Og6Ex6hHK31CAfnob3l3dvoLp/jF6S2rFY+t7DPfpRXpJ4Adz//r91aIVJZUyEg5lG/BHUhAwADTCd9vOwL8T3B/MKWKiA1rYoodmqMJ/HvEyJE5iXjT7QQEIcpIDkbZ66yUUG8stxsbEeoCn1SFPezBJH1013D9XyOGGe8aRE06jqxtPqLQIb0WyNz2lnlCcFg+wtcGM1nDejdjbqrR+88MxxQcL9EnQiEDqgtbYkYkLTiR509UWq8KPtWHrrIt+3GBAcrDus7+HjrqzO5OJtoM2kiVTuVp8e6COk6OiFcm8jkU=~-1~-1~1743308824; ai_session=3roaGteCWos2uZX58PQBoK|1743305222522|1743305799710; utag_main=v_id:0195e516bc5e001cb04f33224e590506f028706700978$_sn:1$_se:40$_ss:0$_st:1743307599815$ses_id:1743305227359%3Bexp-session$_pn:6%3Bexp-session$vapi_domain:woolworths.com.au$dc_visit:1$dc_event:12%3Bexp-session$dc_region:ap-southeast-2%3Bexp-session$dleUpToDate:true%3Bexp-session; _uetsid=de6227c00d1611f0bb28a304fcf99991; _uetvid=de627c100d1611f0967d6f5437ac6024; bm_sv=F108AECBE9FE3A7E31000D443E0266B0~YAAQkgUgFxn2PsuVAQAAK34f5Ru/7JJbjunwvReCRLUoblf/zf59nr0G5v9f9ZXPwAsir+izb7wyf6Xla3Y577lQD6NKx9Nqj1+yKauweRMq6wAYSY7inTN4ARPhNzekBpppHnubn1Qw9iRW0OykxhQ/mldjmbK9yhuYqABkLbfqNuHf2xGAUvxfSnh108GdylANq2pEdwmHDT1UK1rAWcqIe87HfBn1v/jlEjnSYfaWLs6FHP2d7GcTk5EyFKj1jBM+OW+63xo=~1; rxvt=1743307600293|1743305222336; dtPC=2$305798594_796h34vHHVSHQMOFPFVFRPKARDJDGGMHVJUNFWP-0e0",
#     "origin": "https://www.woolworths.com.au",
#     "referer": "https://www.woolworths.com.au/shop/browse/easter/easter-specials",
#     "sec-ch-ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
#     "traceparent": "00-f0046e6fdf6a4e5da1c25f2d176b47e7-0bd9ec254d6644c5-01",
#     "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
#     "x-dtpc": "2$305798594_796h34vHHVSHQMOFPFVFRPKARDJDGGMHVJUNFWP-0e0, 2$305798594_796h34vHHVSHQMOFPFVFRPKARDJDGGMHVJUNFWP-0e0"
# }

# payload = {
#     "categoryId": "1_C4BB750_SPECIALS",
#     "pageNumber": 1,
#     "pageSize": 24,
#     "sortType": "TraderRelevance",
#     "url": "/shop/browse/easter/easter-specials",
#     "location": "/shop/browse/easter/easter-specials",
#     "formatObject": "{\"name\":\"Easter Specials\"}",
#     "isSpecial": True,
#     "isBundle": False,
#     "isMobile": False,
#     "filters": [],
#     "token": "",
#     "gpBoost": 0,
#     "isHideUnavailableProducts": False,
#     "isRegisteredRewardCardPromotion": False,
#     "enableAdReRanking": False,
#     "groupEdmVariants": True,
#     "categoryVersion": "v2",
#     "flags": {
#         "EnableProductBoostExperiment": True
#     }
# }


# response = requests.post(url, headers=headers, data=payload)
# print(response.status_code)

headers= {
    "authority": "www.woolworths.com.au",
    "method": "GET",
    "path": "/apis/ui/PiesCategoriesWithSpecials/",
    "scheme": "https",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "max-age=0",
    # "cookie": "AKA_A2=A; bff_region=syd2; akaalb_woolworths.com.au=~op=www_woolworths_com_au_ZoneA:PROD-ZoneA|www_woolworths_com_au_BFF_SYD_Launch:WOW-BFF-SYD2|~rv=16~m=PROD-ZoneA:0|WOW-BFF-SYD2:0|~os=43eb3391333cc20efbd7f812851447e6~id=7f52342877d85ce6ce02bc0cf5eb9a9c; rxVisitor=1743307150957O9FH9B51SMSIEH242OTNT2JI2DQHP5IK; ai_user=hvvpUBWNb2bIu0dnUackWI|2025-03-30T03:59:11.049Z; at_check=true; dtCookie=v_4_srv_3_sn_Q0NGS31PQABB8A3A0TR53UC79QM6ROB4_perc_100000_ol_0_mul_1_app-3Af908d76079915f06_1_rcs-3Acss_0; INGRESSCOOKIE=1743307153.323.328.647366|37206e05370eb151ee9f1b6a1c80a538; w-rctx=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NDMzMDcxNTIsImV4cCI6MTc0MzMxMDc1MiwiaWF0IjoxNzQzMzA3MTUyLCJpc3MiOiJXb29sd29ydGhzIiwiYXVkIjoid3d3Lndvb2x3b3J0aHMuY29tLmF1Iiwic2lkIjoiMCIsInVpZCI6ImJkNTgwNDNlLTUxZTEtNGYzYi1iNDc2LTQ0NzFlNzFmMGM2YiIsIm1haWQiOiIwIiwiYXV0IjoiU2hvcHBlciIsImF1YiI6IjAiLCJhdWJhIjoiMCIsIm1mYSI6IjEifQ.MABqo980pV5gww7tb-Gluu2eRhqN3wJAeXVCu9ezKYF2-eIx3UkAdnMwS3V7hbdMuuqo-OT1idosQcu8ZQIiauNOzSiq5Y2pZYpeko4jDI0JeurOh91HjD1q6Cyu5y-Q8cKP5z-Bc_n5dp87EUoj4SC7xfO_YoxJE2kKAh39_4Hz_okEX5ZgLFl8nU76vYUK0u4qa4IMW1FS98rKNaBhEsCvPT1U91GFciBguyXlpnUT1CLNwwTcn4YLMMxcDHyPCNk78xyWb4JyRITuVj_UBSASArM7CYNyrhV1FJ7KbcEONgmJxSSYXnxS0LIdo-7mW0aXhlLqxk_IlMrUXLJI7Q; wow-auth-token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NDMzMDcxNTIsImV4cCI6MTc0MzMxMDc1MiwiaWF0IjoxNzQzMzA3MTUyLCJpc3MiOiJXb29sd29ydGhzIiwiYXVkIjoid3d3Lndvb2x3b3J0aHMuY29tLmF1Iiwic2lkIjoiMCIsInVpZCI6ImJkNTgwNDNlLTUxZTEtNGYzYi1iNDc2LTQ0NzFlNzFmMGM2YiIsIm1haWQiOiIwIiwiYXV0IjoiU2hvcHBlciIsImF1YiI6IjAiLCJhdWJhIjoiMCIsIm1mYSI6IjEifQ.MABqo980pV5gww7tb-Gluu2eRhqN3wJAeXVCu9ezKYF2-eIx3UkAdnMwS3V7hbdMuuqo-OT1idosQcu8ZQIiauNOzSiq5Y2pZYpeko4jDI0JeurOh91HjD1q6Cyu5y-Q8cKP5z-Bc_n5dp87EUoj4SC7xfO_YoxJE2kKAh39_4Hz_okEX5ZgLFl8nU76vYUK0u4qa4IMW1FS98rKNaBhEsCvPT1U91GFciBguyXlpnUT1CLNwwTcn4YLMMxcDHyPCNk78xyWb4JyRITuVj_UBSASArM7CYNyrhV1FJ7KbcEONgmJxSSYXnxS0LIdo-7mW0aXhlLqxk_IlMrUXLJI7Q; prodwow-auth-token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NDMzMDcxNTIsImV4cCI6MTc0MzMxMDc1MiwiaWF0IjoxNzQzMzA3MTUyLCJpc3MiOiJXb29sd29ydGhzIiwiYXVkIjoid3d3Lndvb2x3b3J0aHMuY29tLmF1Iiwic2lkIjoiMCIsInVpZCI6ImJkNTgwNDNlLTUxZTEtNGYzYi1iNDc2LTQ0NzFlNzFmMGM2YiIsIm1haWQiOiIwIiwiYXV0IjoiU2hvcHBlciIsImF1YiI6IjAiLCJhdWJhIjoiMCIsIm1mYSI6IjEifQ.MABqo980pV5gww7tb-Gluu2eRhqN3wJAeXVCu9ezKYF2-eIx3UkAdnMwS3V7hbdMuuqo-OT1idosQcu8ZQIiauNOzSiq5Y2pZYpeko4jDI0JeurOh91HjD1q6Cyu5y-Q8cKP5z-Bc_n5dp87EUoj4SC7xfO_YoxJE2kKAh39_4Hz_okEX5ZgLFl8nU76vYUK0u4qa4IMW1FS98rKNaBhEsCvPT1U91GFciBguyXlpnUT1CLNwwTcn4YLMMxcDHyPCNk78xyWb4JyRITuVj_UBSASArM7CYNyrhV1FJ7KbcEONgmJxSSYXnxS0LIdo-7mW0aXhlLqxk_IlMrUXLJI7Q; AMCVS_4353388057AC8D357F000101%40AdobeOrg=1; AMCV_4353388057AC8D357F000101%40AdobeOrg=179643557%7CMCIDTS%7C20178%7CMCMID%7C40193431683900629112472616802567376364%7CMCAAMLH-1743911951%7C8%7CMCAAMB-1743911951%7CRKhpRz8krg2tLO6pguXWp5olkAcUniQYPHaMWWgdJ3xzPWQmdj0y%7CMCOPTOUT-1743314351s%7CNONE%7CvVersion%7C5.5.0; _abck=4B1F735CAFABA02144427D5859ADF419~0~YAAQyGcoF9DNRaiVAQAADR405Q2S4MUebRbngeRiKwrb6GUy9gihVj1OX/hERdgPxTSnwh+5tlgJ/GCt6xc40Rwyyth7Zmde1pUBSkpZj9PpuoPxFlJIcztxB+Ichnk9OXAXkbgYQhByJX8Sn9DT81VQPVXzabPCKvsKOa5V1iBRpJNHlahst/aXWpjwRBKvyZvYRKPivFByVoZk9FQEirmaKzEPqrdknv3R1P47EyXkRNiGBF6AxUEDJUCXfO3uD8EEJxdpz35wmT1CGstxNrZAWGU5Bl9t8oqjJHzeN/i9e56Zc3oalMVVY9ZCvatpqmBfXdmccCZV1nE5GzzBIiJJ3vWvcCH1Aql4h4Z6DjDQ6KJvlWOP9QiVctDb5Vhja20zB0R8WTnqA/wzZbn4P7EXWJ10VjQJDZcltGsnNXPY7DwM0qDjU4fAioiZS0T9/YMo5lmuQBOTOeRQRTJoHN8Fi6NalkMdwc9yDwUT75g07LdysJZRAAM1EipfsmYoieJ4T3ilFadiHgewa8IUkKRAd3Vc2d8Z9v1C0yU0RP+7tQo=~-1~||0||~1743310752; mbox=session#35920b68ce5e45e386bef6ede49e03f7#1743309013|PC#35920b68ce5e45e386bef6ede49e03f7.36_0#1806551953; ai_session=TbTYliFrV2Y6mmoH5C3W2R|1743307151196|1743307152339; ak_bmsc=5A9F45CF6E2DF8C5D5262DCD47170634~000000000000000000000000000000~YAAQyGcoFxjPRaiVAQAAliA05RtDjAFKzGpqEVg1aPh4SQZq9bbve+xw74QVnT3DYukxkZnvcvv9dTXXzitcq+tEhlCNlNX5W3+T8evZ9/ecxsJZ9gD3zU4YEZoRavPOUssFPJ3VeD/Mt9XNUD6U1wxc8I1lKu5o2mBCCHpzVAJ7BIwl1igyiVp9Rqcel4yzSthaF6xQk2Rnl9zjo1O1eaiLWIHVROkZDENjedI1KabJbon/VQF8I/rTMcBoZhrx5VDvw9UyhoftgWOOiNHTQL1zv1ZIFjkf3/KqLDaQQJfIPx//XiYEn/bFwX9lb9OvyfZt+qhvy4BAX5sFcGlIxVdgwIGC/dOYQMSuPZOWXrov2VLYu+DcV4lsW32Tns6Ab0T/bD5twJ5+9X+Ftc5Io7/SjX68VzpIHk1YGVyyPBzbLfQJWUifmXxOmagcefap3EXW9FhE30RLlk0ACwZ/vxqEW+g=; rxvt=1743308952745|1743307150961; dtPC=3$307150949_741h-vFRUAQIGTPCRURGHRKURMPOOCKROBCRAL-0e0; dtSa=false%7C_load_%7C30%7C_onload_%7C-%7C1743307152635%7C307150949_741%7Chttps%3A%2F%2Fwww.woolworths.com.au%2F%7C%7C%7C%7C; RT="z=1&dm=www.woolworths.com.au&si=8e19ca72-d5fc-4e1b-b746-d23d393cb589&ss=m8v42e4t&sl=1&tt=1rl&rl=1&ld=2c5&hd=32r"; bm_sv=931CC11B2CB48551E2638BBD25ED78B9~YAAQkgUgF8RvQcuVAQAALU1D5RvVUj6NNUTJWo6fwv8lg8T/MWYv6HoEEYTxieJeM7QHIMrgmag1UisSV6VG7XLOXUGUWS7sRoimzKLkKJeGZqmAkhKejxfaXkntRTI2zwEgr7mtzzAPj8jee3JbtXkDS3SGwR26l5PyMFj81UtfmSsQi4jVJon20P2YLt70IvidHv66gHNYs4DdxPKURY9OrkO8M2aTdscfPOIQpD7KYy4V+M8JWbtAteboZwCiDqoE1AWzzg==~1; bm_sz=51D8AF795AE1442470E5A511FE1AC957~YAAQkgUgF8VvQcuVAQAALU1D5Rt+N/E2GEfCGNvwgUDLcAgfdp7dny2FCXw3jg0LSthe6isAXhKVujRX8xwHAO7jZU47vFc1meLLGhpgCn/mPPNuOWRii5qppbHrO7JgTMR7PpOFABI7VTNNK7jVs2n3iNEgmvm8uE1eRHJn4UASOV++Omw4nOqebKZhhqjcC5XbiJhgD5SymGFXbZw+WEl54ATIv7pFtqZs4P3GWxe73TQuGK3a/uWw6JaSwnFS0r7JW2GdcPrtE+BC2VmnUgV1ey9qzM6sDak0TzB/NGorsxINaMme4SQmS7Y+CxoZ5s1CZzCqz39FnkHOwV6tKPIKbqziweV9dt82nVkq2pafD0VY/AssE8lFYgNcNMuDdogkQfwO8GnZ+qEzxC2bE/IMauxh74qBnkrBtKka~3290948~3686708",
    "priority": "u=0, i",
    "sec-ch-ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
    "sec-ch-ua-mobile": "?0",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
}


import json, requests, sys, datetime
import os

PARAM_API = 'https://www.woolworths.com.au/apis/ui/PiesCategoriesWithSpecials/'
PRODUCT_API = 'https://www.woolworths.com.au/apis/ui/browse/category'

def printWithTime(text):
    now = datetime.datetime.now()
    now = '[' + now.strftime('%d-%m %H:%M:%S') + ']'
    print(f'{now} {text}')

def generateCategoryParams(dataParams):
    categoryParams = {}
    for category in dataParams['Categories']:
        if category['NodeId'] == 'specialsgroup':
            for children in category['Children']:
                if children['UrlFriendlyName'] == 'half-price':
                    for subChildren in children['Children']:
                        categoryParamId = subChildren['UrlFriendlyName']
                        formatObject = "{'name': '" + subChildren['Description'] + "'}"
                        location = "/shop/browse/specials/half-price/" + subChildren['UrlFriendlyName']
                        categoryParam = {
                            "categoryId": subChildren['NodeId'],
                            "filters": None,
                            "formatObject": formatObject,
                            "isBundle": False,
                            "isMobile": False,
                            "isSpecial": True,
                            "location": location,
                            "pageNumber": 1,
                            "pageSize": 999,
                            "sortType": 'Name',
                            "url": location
                        }
                        categoryParams[categoryParamId] = categoryParam
                    return categoryParams
    return False

def getCategoryList(params):
    paramIds = list(params.keys())
    categories = {}
    for i in paramIds:
        if i == 'lunch-box':
            continue
        formatObject = params[i]['formatObject']
        categoryName = formatObject.replace("{'name': ", "").replace("'", "").replace("}", "")
        categories[i] = {
            'name': categoryName
        }
    return categories

def generateProductId(item):
    stockcode = str(item['Stockcode']).replace(' ', '')
    barcode = str(item['Barcode']).replace(' ', '')
    return f'w{stockcode}-{barcode}'

def generateProductDetails(item, category, productId):
    if not isinstance(item['Barcode'], list):
        barcode = [item['Barcode']]
    if item['InstoreHasCupPrice']:
        cupPrice = item['InstoreCupString'].lower()
    else:
        cupPrice = None
    print(item)
    return {
        'id': productId,
        'store': 'woolworths',
        'name': item['Name'],
        'brand': toCapitalized(item['Brand']),
        'price': item['InstorePrice'],
        'orgPrice': item['InstoreWasPrice'],
        'categoryIds': ['household' if category == 'lunch-box' else category], # lunch-box will be merged with household
        'imagePath': item['DetailsImagePaths'][0],
        'cupPrice': cupPrice,
        'unit': item['Unit'].lower(),
        'packageSize': item['PackageSize'].lower(),
        'barcode': barcode,
        'isAvailable': True,
        'locations': ['vic','nsw','qld','wa','sa','tas','nt','act']
    }

def toCapitalized(text):
    if text is None:
        return ''
    words = text.split()
    result = []
    for word in words:
        result.append(word.replace(' ', '').capitalize())
    return ' '.join(result)

if __name__ == '__main__':
    printWithTime('Scrapping data from Woolworths...')

    # Generate params from PARAM_API
    # Each param corresponds to one category
    response = requests.get(PARAM_API, headers=headers)
    if response.status_code == 200:
        dataParams = response.json()
        printWithTime('Generating category params...')
    else:
        printWithTime('Cannot connect to server')
        sys.exit()

    categoryParams = generateCategoryParams(dataParams)
    categoryParamIds = list(categoryParams.keys())
    printWithTime('Params have been generated.')
    # Categories with id
    categories = getCategoryList(categoryParams)
    if not os.path.exists('categories.json'):
        with open('categories.json', 'w', encoding='utf-8') as categoryFile:
            json.dump(categories, categoryFile)

    # Use generated params to get products
    products = []
    count = 0
    for i in categoryParamIds:
        printWithTime(f'Getting products of {i}...')
        response = requests.get(PRODUCT_API, params=categoryParams[i])
        if response.status_code != 200:
            printWithTime(f'Cannot get products of {i}')
            continue
        dataProducts = response.json()
        if len(dataProducts['Bundles']) > 0:
            for item in dataProducts['Bundles']:
                instoreIsAvailable = item['Products'][0]['InstoreIsAvailable']
                instorePrice = item['Products'][0]['InstorePrice']
                if instoreIsAvailable and instorePrice > 0:
                    products.append(generateProductDetails(item['Products'][0], i, generateProductId(item['Products'][0])))
                    count = count + 1
    printWithTime('Done getting data. Writing to file...')
    with open('./products.json','w', encoding='utf-8') as productFile:
        json.dump(products, productFile)
    printWithTime(f'ALL DONE. TOTAL {count} PRODUCTS!')

